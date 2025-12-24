import { GeoNamesDB } from './database.js';
import { geocodeText } from './geocoder.js';
import { MESSAGE_TYPES } from '../utils/constants.js';
import { addMessageListener, sendToSidePanel, createMessage } from '../utils/message.js';
import { getCountryName } from '../utils/format.js';

// Global state
let db = null;
let isInitialized = false;
let currentPageText = null; // Store page text for rescanning after downloads
let currentPageUrl = null;
let selectedCountries = []; // User-selected countries to use in full scan

/**
 * Initialize database and load cities data
 */
async function initialize() {
  if (isInitialized) {
    console.log('Already initialized');
    return;
  }

  try {
    console.log('🚀 Initializing GeoLocator...');

    // Initialize database
    db = new GeoNamesDB();
    await db.init();

    // Check if cities data is already loaded
    const citiesLoaded = await db.isCitiesLoaded();

    if (!citiesLoaded) {
      console.log('📦 Loading cities data for first time...');

      // Fetch cities15000.json
      const response = await fetch(chrome.runtime.getURL('data/cities15000.json'));
      const cities = await response.json();

      // Load into database
      await db.loadCities(cities);

      console.log('✅ Cities data loaded successfully');
    } else {
      const count = await db.getCitiesCount();
      console.log(`✅ Database ready with ${count.toLocaleString()} cities`);
    }

    isInitialized = true;
    console.log('🎉 GeoLocator initialized!');
  } catch (error) {
    console.error('❌ Initialization error:', error);
    throw error;
  }
}

/**
 * Handle extension icon click - open side panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Open the side panel
    await chrome.sidePanel.open({ windowId: tab.windowId });

    // Ensure database is initialized
    if (!isInitialized) {
      await initialize();
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

/**
 * Handle messages from content script and side panel
 */
addMessageListener(async (message, sender) => {
  const { type, data } = message;

  console.log('📨 Received message:', type);

  // Ensure database is initialized for most operations
  if (type !== MESSAGE_TYPES.DB_READY && !isInitialized) {
    await initialize();
  }

  switch (type) {
    case 'PING':
      // Content script ping to check if it's already injected
      return { pong: true };

    case MESSAGE_TYPES.PAGE_TEXT:
      // Received page text from content script - start geocoding
      return await handlePageText(data.text, data.url);

    case MESSAGE_TYPES.START_GEOCODING:
      // Side panel requests to start geocoding
      return await startGeocoding();

    case MESSAGE_TYPES.DB_READY:
      // Check if database is ready
      return { ready: isInitialized };

    case MESSAGE_TYPES.DOWNLOAD_COUNTRIES:
      // Download country-specific data and rescan
      return await handleCountryDownload(data.countryCodes);

    default:
      console.warn('Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
});

/**
 * Start geocoding process for current tab
 */
async function startGeocoding() {
  try {
    console.log('🔍 Starting geocoding...');

    // Send progress update to sidepanel
    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_PROGRESS, {
      status: 'extracting',
      message: 'Extracting text from page...',
    }));

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found. Please open a web page first.');
    }

    console.log(`🔍 Active tab detected: ${tab.url}`);

    // Check if it's a valid web page
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error(`Cannot scan this page. Current tab URL: ${tab.url || 'undefined'}. Please click on a regular web page tab (http:// or https://) and try again.`);
    }

    console.log(`📄 Scanning tab: ${tab.title} (${tab.url})`);


    // Inject content script if not already injected
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    } catch {
      // Not injected, inject now
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js'],
      });
    }

    // Request text extraction
    const response = await chrome.tabs.sendMessage(tab.id, createMessage(MESSAGE_TYPES.EXTRACT_TEXT));

    if (response && response.text) {
      return await handlePageText(response.text, tab.url);
    } else {
      throw new Error('Failed to extract text from page');
    }
  } catch (error) {
    console.error('Geocoding error:', error);

    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_ERROR, {
      error: error.message,
    }));

    throw error;
  }
}

/**
 * Get country suggestions for user selection
 * Always shows all detected countries (even if downloaded) for user approval
 * User selection indicates relevance and improves accuracy
 */
async function getCountrySelectionOptions(detectedCountries) {
  const options = [];

  for (const { code, count } of detectedCountries) {
    const isDownloaded = await db.isCountryDownloaded(code);
    options.push({
      countryCode: code,
      countryName: getCountryName(code),
      hitCount: count,
      isDownloaded: isDownloaded,
    });
  }

  return options;
}

/**
 * Handle country download and scan request
 * Downloads needed countries and scans using ONLY user-selected countries
 */
async function handleCountryDownload(countryCodes) {
  try {
    // Store user-selected countries (indicates relevance)
    selectedCountries = countryCodes;
    console.log(`✅ User selected ${selectedCountries.length} countries:`, selectedCountries);

    // Determine which countries need to be downloaded
    const toDownload = [];
    for (const code of countryCodes) {
      const isDownloaded = await db.isCountryDownloaded(code);
      if (!isDownloaded) {
        toDownload.push(code);
      }
    }

    console.log(`⬇️ Need to download ${toDownload.length} countries:`, toDownload);

    // Download any countries that aren't already cached
    for (let i = 0; i < toDownload.length; i++) {
      const countryCode = toDownload[i];

      // Send progress update
      await sendToSidePanel(createMessage(MESSAGE_TYPES.DOWNLOAD_PROGRESS, {
        countryCode: countryCode,
        countryName: getCountryName(countryCode),
        current: i + 1,
        total: toDownload.length,
        status: 'downloading',
      }));

      // Download and process country data
      await downloadCountryData(countryCode);
    }

    // Send completion message
    await sendToSidePanel(createMessage(MESSAGE_TYPES.DOWNLOAD_COMPLETE, {
      count: toDownload.length,
      selected: selectedCountries.length,
    }));

    // Trigger full scan with user-selected countries only
    console.log(`🔄 Triggering full scan with ${selectedCountries.length} selected countries...`);
    await performFullScan();

    return { success: true, downloaded: toDownload.length, selected: selectedCountries.length };
  } catch (error) {
    console.error('Country download error:', error);

    await sendToSidePanel(createMessage(MESSAGE_TYPES.DOWNLOAD_ERROR, {
      error: error.message,
    }));

    throw error;
  }
}

/**
 * Download and process country-specific data from GeoNames
 */
async function downloadCountryData(countryCode) {
  try {
    console.log(`📥 Downloading ${countryCode}.zip...`);

    // GeoNames URL for country data (ZIP compressed)
    const url = `http://download.geonames.org/export/dump/${countryCode}.zip`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${countryCode}: ${response.statusText}`);
    }

    // Get ZIP file as array buffer
    const arrayBuffer = await response.arrayBuffer();

    console.log(`📦 Extracting ${countryCode}.zip (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)...`);

    // Unzip and extract text content
    const text = await unzipCountryFile(arrayBuffer, countryCode);

    const cities = parseGeoNamesData(text, countryCode);

    console.log(`✅ Processed ${cities.length.toLocaleString()} places for ${countryCode}`);

    // Load into database
    await db.loadCountryData(countryCode, cities);

    // Verify data was loaded
    const totalCount = await db.getCountryDataCount();
    console.log(`📊 Country data store now has ${totalCount.toLocaleString()} total entries`);

    return cities;
  } catch (error) {
    console.error(`Error downloading ${countryCode}:`, error);
    throw error;
  }
}

/**
 * Unzip country file and extract text content
 * Uses native browser APIs to decompress ZIP files
 */
async function unzipCountryFile(arrayBuffer, countryCode) {
  try {
    // ZIP file parser that handles multi-file archives
    const view = new DataView(arrayBuffer);

    // Find end of central directory signature (0x06054b50)
    let eocdOffset = -1;
    for (let i = arrayBuffer.byteLength - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Invalid ZIP file: End of central directory not found');
    }

    // Read number of entries and central directory offset
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const centralDirOffset = view.getUint32(eocdOffset + 16, true);

    console.log(`📦 ZIP contains ${totalEntries} files, scanning for ${countryCode}.txt...`);

    // Iterate through central directory entries to find the target file
    let currentOffset = centralDirOffset;
    let targetEntry = null;
    const targetFilename = `${countryCode}.txt`;

    for (let i = 0; i < totalEntries; i++) {
      // Check central directory file header signature
      if (view.getUint32(currentOffset, true) !== 0x02014b50) {
        throw new Error('Invalid ZIP file: Central directory signature not found');
      }

      // Read entry metadata
      const fileNameLength = view.getUint16(currentOffset + 28, true);
      const extraFieldLength = view.getUint16(currentOffset + 30, true);
      const fileCommentLength = view.getUint16(currentOffset + 32, true);

      // Read filename
      const filenameBytes = new Uint8Array(arrayBuffer, currentOffset + 46, fileNameLength);
      const filename = new TextDecoder('utf-8').decode(filenameBytes);

      console.log(`  📄 Found file in ZIP: "${filename}"`);

      // Check if this is our target file
      if (filename === targetFilename) {
        targetEntry = {
          compressionMethod: view.getUint16(currentOffset + 10, true),
          compressedSize: view.getUint32(currentOffset + 20, true),
          uncompressedSize: view.getUint32(currentOffset + 24, true),
          localHeaderOffset: view.getUint32(currentOffset + 42, true),
          filename: filename
        };
        console.log(`✅ Found target file: "${filename}"`);
        console.log(`📏 Compressed: ${targetEntry.compressedSize} bytes, Uncompressed: ${targetEntry.uncompressedSize} bytes`);
        break;
      }

      // Move to next entry
      currentOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }

    if (!targetEntry) {
      throw new Error(`File ${targetFilename} not found in ZIP archive`);
    }

    // Read local file header for the target file
    const localHeaderOffset = targetEntry.localHeaderOffset;
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error('Invalid ZIP file: Local file header signature not found');
    }

    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraFieldLength = view.getUint16(localHeaderOffset + 28, true);

    // Calculate data offset
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;

    // Use sizes from central directory (more reliable)
    const compressedSize = targetEntry.compressedSize;
    const uncompressedSize = targetEntry.uncompressedSize;
    const compressionMethod = targetEntry.compressionMethod;

    console.log(`📊 Compression: ${compressionMethod === 8 ? 'DEFLATE' : 'STORE'}, Size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB → ${(uncompressedSize / 1024 / 1024).toFixed(2)} MB`);

    // Extract compressed data
    const compressedData = new Uint8Array(arrayBuffer, dataOffset, compressedSize);

    // Decompress based on method
    if (compressionMethod === 0) {
      // No compression (store)
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(compressedData);
    } else if (compressionMethod === 8) {
      // DEFLATE compression - use DecompressionStream
      const blob = new Blob([compressedData]);
      const stream = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const decompressedBlob = await new Response(stream).blob();
      const text = await decompressedBlob.text();

      console.log(`✅ Decompressed ${(text.length / 1024 / 1024).toFixed(2)} MB of text data`);
      return text;
    } else {
      throw new Error(`Unsupported compression method: ${compressionMethod}`);
    }
  } catch (error) {
    console.error('Unzip error:', error);
    throw new Error(`Failed to extract ${countryCode}.zip: ${error.message}`);
  }
}

/**
 * Parse GeoNames tab-delimited data
 */
function parseGeoNamesData(text, countryCode) {
  const lines = text.split('\n');
  const cities = [];

  console.log(`📝 Parsing GeoNames data for ${countryCode}: ${lines.length.toLocaleString()} lines`);

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = line.split('\t');
    if (fields.length < 15) continue;

    // Skip non-populated places (feature class != 'P')
    if (fields[6] !== 'P') continue;

    cities.push({
      geonameId: parseInt(fields[0]),
      name: fields[1],
      ascii: fields[2].toLowerCase(),
      alternates: fields[3] ? fields[3].split(',').slice(0, 5) : [],
      lat: parseFloat(fields[4]),
      lng: parseFloat(fields[5]),
      country: fields[8],
      admin1: fields[10],
      pop: parseInt(fields[14]) || 0,
      fclass: fields[6],
      fcode: fields[7],
    });
  }

  console.log(`📝 Parsed ${cities.length.toLocaleString()} populated places (feature class 'P') from ${countryCode}`);
  if (cities.length > 0) {
    console.log(`📝 Sample parsed city:`, cities[0]);
    console.log(`📝 Sample ascii name: "${cities[0].ascii}", country: "${cities[0].country}"`);
  }

  return cities;
}

/**
 * Handle extracted page text - Phase 1: Country detection only
 */
async function handlePageText(text, url) {
  try {
    console.log(`Processing ${text.length} characters from ${url}`);

    // Store for later rescan after downloads
    currentPageText = text;
    currentPageUrl = url;

    // Send progress update
    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_PROGRESS, {
      status: 'detecting',
      message: 'Detecting countries...',
    }));

    // PHASE 1: Detection-only scan using cities15000
    // Don't return location matches, just detect which countries are mentioned
    const { detectedCountries } = await geocodeText(text, db, { detectionOnly: true });

    console.log(`📍 Detected countries (top 10 by frequency): ${detectedCountries.map(c => `${c.code}(${c.count})`).join(', ')}`);

    // Get country selection options (always show for user approval, even if downloaded)
    const countryOptions = await getCountrySelectionOptions(detectedCountries);

    // Send country selection UI (user chooses which countries are relevant)
    await sendToSidePanel(createMessage(MESSAGE_TYPES.COUNTRY_DETECTION, {
      detectedCountries: detectedCountries,
      countryOptions: countryOptions,
      url: url,
    }));

    return { success: true, phase: 'detection', options: countryOptions.length };
  } catch (error) {
    console.error('Error processing text:', error);

    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_ERROR, {
      error: error.message,
    }));

    throw error;
  }
}

/**
 * Perform full scan with country-specific data only (Phase 2)
 * Scans using ONLY user-selected countries for improved accuracy
 */
async function performFullScan() {
  try {
    console.log(`🔍 Starting FULL SCAN with ${selectedCountries.length} selected countries...`);

    // Verify country data is loaded
    const countryDataCount = await db.getCountryDataCount();
    console.log(`📊 Country data store has ${countryDataCount.toLocaleString()} total entries`);

    // Send progress update
    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_PROGRESS, {
      status: 'scanning',
      message: `Matching locations in ${selectedCountries.length} selected countries...`,
    }));

    // PHASE 2: Full scan using ONLY downloaded country-specific data
    // Filter by user-selected countries only (improves accuracy)
    const { locations, detectedCountries } = await geocodeText(currentPageText, db, {
      detectionOnly: false,
      useCountryDataOnly: true, // Search ONLY country data (per user requirement)
      filterCountries: selectedCountries // Only return matches from selected countries
    });

    console.log(`✅ Found ${locations.length} locations in ${selectedCountries.length} selected countries`);

    // Send final results to sidepanel
    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_RESULTS, {
      locations: locations,
      url: currentPageUrl,
      suggestedDownloads: [], // No more suggestions after selection
      selectedCountries: selectedCountries,
    }));

    return { success: true, phase: 'full-scan', count: locations.length };
  } catch (error) {
    console.error('Error in full scan:', error);

    await sendToSidePanel(createMessage(MESSAGE_TYPES.GEOCODE_ERROR, {
      error: error.message,
    }));

    throw error;
  }
}

// Import geocoder (removed mock function - now using real geocoder)

// Initialize on extension install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    console.log('First install - initializing database...');
    await initialize();
  } else if (details.reason === 'update') {
    console.log('Extension updated');
    // Could handle migration here if needed
  }
});

// Initialize on browser startup if extension was already installed
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started - ensuring database is ready');
  await initialize();
});

console.log('🔵 Background service worker loaded');
