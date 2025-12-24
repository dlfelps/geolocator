import { MESSAGE_TYPES, COUNTRY_NAMES } from '../utils/constants.js';
import { sendToBackground, addMessageListener, createMessage } from '../utils/message.js';

// State
let currentLocations = [];
let currentUrl = '';
let suggestedDownloads = [];
let currentView = 'list'; // 'list' or 'map'
let mapInitialized = false;
let mapIframeLoaded = false;

// UI Elements
const elements = {
  status: null,
  loading: null,
  loadingText: null,
  emptyState: null,
  errorState: null,
  errorMessage: null,
  results: null,
  locationCount: null,
  locationsList: null,
  scanBtn: null,
  retryBtn: null,
  exportBtn: null,
  rescanBtn: null,
  downloadSuggestions: null,
  countryCheckboxes: null,
  downloadSelectedBtn: null,
  skipDownloadBtn: null,
  // Settings modal
  settingsBtn: null,
  settingsModal: null,
  closeSettingsBtn: null,
  cancelSettingsBtn: null,
  saveSettingsBtn: null,
  apiKeyInput: null,
  apiKeyError: null,
  // Map view
  viewToggle: null,
  mapContainer: null,
  mapIframe: null,
  mapLoading: null,
  mapError: null,
  mapErrorMessage: null,
  retryMapBtn: null,
};

/**
 * Initialize UI and event listeners
 */
function init() {
  console.log('🎨 Initializing sidepanel...');

  // Get all UI elements
  elements.status = document.getElementById('status');
  elements.loading = document.getElementById('loading');
  elements.loadingText = document.getElementById('loading-text');
  elements.emptyState = document.getElementById('empty-state');
  elements.errorState = document.getElementById('error-state');
  elements.errorMessage = document.getElementById('error-message');
  elements.results = document.getElementById('results');
  elements.locationCount = document.getElementById('location-count');
  elements.locationsList = document.getElementById('locations-list');
  elements.scanBtn = document.getElementById('scan-btn');
  elements.retryBtn = document.getElementById('retry-btn');
  elements.exportBtn = document.getElementById('export-btn');
  elements.rescanBtn = document.getElementById('rescan-btn');
  elements.downloadSuggestions = document.getElementById('download-suggestions');
  elements.countryCheckboxes = document.getElementById('country-checkboxes');
  elements.downloadSelectedBtn = document.getElementById('download-selected-btn');
  elements.skipDownloadBtn = document.getElementById('skip-download-btn');

  // Settings modal elements
  elements.settingsBtn = document.getElementById('settings-btn');
  elements.settingsModal = document.getElementById('settings-modal');
  elements.closeSettingsBtn = document.getElementById('close-settings');
  elements.cancelSettingsBtn = document.getElementById('cancel-settings');
  elements.saveSettingsBtn = document.getElementById('save-settings');
  elements.apiKeyInput = document.getElementById('api-key-input');
  elements.apiKeyError = document.getElementById('api-key-error');

  // Map view elements
  elements.viewToggle = document.getElementById('view-toggle');
  elements.mapContainer = document.getElementById('map-container');
  elements.mapIframe = document.getElementById('map-iframe');
  elements.mapLoading = document.getElementById('map-loading');
  elements.mapError = document.getElementById('map-error');
  elements.mapErrorMessage = document.getElementById('map-error-message');
  elements.retryMapBtn = document.getElementById('retry-map');

  // Add event listeners
  elements.scanBtn.addEventListener('click', handleScan);
  elements.retryBtn.addEventListener('click', handleScan);
  elements.rescanBtn.addEventListener('click', handleScan);
  elements.exportBtn.addEventListener('click', handleExport);
  elements.downloadSelectedBtn.addEventListener('click', handleDownloadCountries);
  elements.skipDownloadBtn.addEventListener('click', hideDownloadSuggestions);

  // Listen for messages from background script
  setupMessageListener();

  // Listen for messages from map iframe
  setupMapMessageListener();

  // Setup view toggle (no settings modal needed for Leaflet/OSM)
  setupViewToggle();

  console.log('✅ Sidepanel initialized');
}

/**
 * Set up message listener for background script
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, data } = message;

    console.log('📨 Sidepanel received message:', type);

    switch (type) {
      case MESSAGE_TYPES.GEOCODE_PROGRESS:
        showLoading(data.message);
        break;

      case MESSAGE_TYPES.COUNTRY_DETECTION:
        // Phase 1: Show only country selection (no preliminary results)
        handleCountryDetection(data.countryOptions, data.url);
        break;

      case MESSAGE_TYPES.GEOCODE_RESULTS:
        // Phase 2: Show final results after downloads
        handleResults(data.locations, data.url, data.suggestedDownloads || []);
        break;

      case MESSAGE_TYPES.GEOCODE_ERROR:
        showError(data.error);
        break;

      case MESSAGE_TYPES.DOWNLOAD_PROGRESS:
        showLoading(`Downloading ${data.countryName} (${data.current}/${data.total})...`);
        break;

      case MESSAGE_TYPES.DOWNLOAD_COMPLETE:
        console.log(`✅ Downloads complete! Downloaded ${data.count} countries`);
        showLoading('Scanning with country-specific data...');
        // Rescan will be triggered automatically by background script
        break;

      case MESSAGE_TYPES.DOWNLOAD_ERROR:
        showError(`Download failed: ${data.error}`);
        // Re-enable download button
        if (elements.downloadSelectedBtn) {
          elements.downloadSelectedBtn.disabled = false;
          elements.downloadSelectedBtn.innerHTML = '<span>⬇️</span> Download & Rescan';
        }
        break;
    }

    sendResponse({ received: true });
    return true;
  });
}

/**
 * Set up message listener for map iframe
 */
function setupMapMessageListener() {
  window.addEventListener('message', (event) => {
    console.log('📨 Received postMessage:', event.data, 'from:', event.origin);

    // Only accept messages from our iframe
    if (event.source !== elements.mapIframe.contentWindow) {
      console.log('⚠️ Message not from our iframe, ignoring');
      return;
    }

    const { type, data, error, count } = event.data;
    console.log('✅ Received message from map iframe:', type);

    switch (type) {
      case 'MAP_PAGE_LOADED':
        mapIframeLoaded = true;
        console.log('✅ Map iframe loaded');
        break;

      case 'MAP_READY':
        mapInitialized = true;
        elements.mapLoading.style.display = 'none';
        console.log('✅ Map initialized');

        // Display locations if we have any
        if (currentLocations.length > 0) {
          sendMessageToMap('DISPLAY_LOCATIONS', { locations: currentLocations });
        }
        break;

      case 'MAP_ERROR':
        mapInitialized = false;
        elements.mapLoading.style.display = 'none';
        elements.mapError.style.display = 'flex';
        elements.mapErrorMessage.textContent = error || 'Failed to load map';
        console.error('Map error:', error);
        break;

      case 'LOCATIONS_DISPLAYED':
        elements.mapLoading.style.display = 'none';
        console.log(`✅ Displayed ${count} locations on map`);
        break;
    }
  });
}

/**
 * Send message to map iframe
 */
function sendMessageToMap(type, data = {}) {
  console.log(`📤 Sending message to map: ${type}`, data);
  if (elements.mapIframe && elements.mapIframe.contentWindow) {
    elements.mapIframe.contentWindow.postMessage({ type, data }, '*');
    console.log('✅ Message sent to iframe');
  } else {
    console.error('❌ Cannot send message - iframe not ready');
  }
}

/**
 * Handle scan button click
 */
async function handleScan() {
  try {
    console.log('🔍 Starting scan...');

    showLoading('Scanning page...');

    // Send message to background to start geocoding
    await sendToBackground(createMessage(MESSAGE_TYPES.START_GEOCODING));
  } catch (error) {
    console.error('Scan error:', error);
    showError(error.message);
  }
}

/**
 * Handle country detection (Phase 1 - show only country selection)
 */
function handleCountryDetection(countryOptions, url) {
  console.log(`🌍 Country detection complete`);
  console.log(`📥 Country options:`, countryOptions);

  currentUrl = url;
  suggestedDownloads = countryOptions;

  // Hide loading and empty states
  elements.loading.style.display = 'none';
  elements.emptyState.style.display = 'none';
  elements.errorState.style.display = 'none';

  // Show results container (but with no locations yet)
  elements.results.style.display = 'block';
  elements.locationCount.textContent = '0';

  // Clear locations list
  elements.locationsList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">Select relevant countries below to see locations...</p>';

  // Show country selection UI (sorted by frequency, top 10)
  if (countryOptions && countryOptions.length > 0) {
    showCountrySelection(countryOptions);
  }

  elements.status.textContent = `Detected ${countryOptions.length} relevant ${countryOptions.length === 1 ? 'country' : 'countries'}`;
}

/**
 * Handle geocoding results (Phase 2 - final results after downloads)
 */
function handleResults(locations, url, suggestedDownloadsParam = []) {
  console.log(`✅ Received ${locations.length} locations`);
  console.log(`📥 Suggested downloads:`, suggestedDownloadsParam);

  currentLocations = locations;
  currentUrl = url;
  suggestedDownloads = suggestedDownloadsParam;

  if (locations.length === 0) {
    showEmpty('No locations found on this page');
    return;
  }

  // Display results
  showResults(locations);

  // Show country selection if any suggestions
  if (suggestedDownloads.length > 0) {
    showCountrySelection(suggestedDownloads);
  } else {
    hideDownloadSuggestions();
  }
}

/**
 * Show loading state
 */
function showLoading(message = 'Loading...') {
  elements.emptyState.style.display = 'none';
  elements.errorState.style.display = 'none';
  elements.results.style.display = 'none';
  elements.loading.style.display = 'block';

  elements.loadingText.textContent = message;
  elements.status.textContent = message;
}

/**
 * Show error state
 */
function showError(message) {
  elements.emptyState.style.display = 'none';
  elements.loading.style.display = 'none';
  elements.results.style.display = 'none';
  elements.errorState.style.display = 'block';

  elements.errorMessage.textContent = message;
  elements.status.textContent = 'Error';
}

/**
 * Show empty state
 */
function showEmpty(message = 'Ready to scan') {
  elements.loading.style.display = 'none';
  elements.errorState.style.display = 'none';
  elements.results.style.display = 'none';
  elements.emptyState.style.display = 'block';

  elements.status.textContent = message;
}

/**
 * Show results
 */
function showResults(locations) {
  elements.emptyState.style.display = 'none';
  elements.loading.style.display = 'none';
  elements.errorState.style.display = 'none';
  elements.results.style.display = 'block';

  // Update count
  elements.locationCount.textContent = locations.length;
  elements.status.textContent = `Found ${locations.length} location${locations.length !== 1 ? 's' : ''}`;

  // Show view toggle if we have locations
  if (locations.length > 0) {
    elements.viewToggle.style.display = 'flex';
  } else {
    elements.viewToggle.style.display = 'none';
  }

  // Ensure we're in list view when showing new results
  currentView = 'list';
  elements.locationsList.style.display = 'block';
  elements.mapContainer.style.display = 'none';

  // Update toggle button states
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  toggleButtons.forEach(button => {
    if (button.dataset.view === 'list') {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });

  // Render location cards
  renderLocations(locations);
}

/**
 * Render location cards
 */
function renderLocations(locations) {
  elements.locationsList.innerHTML = '';

  for (const location of locations) {
    const card = createLocationCard(location);
    elements.locationsList.appendChild(card);
  }
}

/**
 * Create a location card element
 */
function createLocationCard(location) {
  const card = document.createElement('div');
  card.className = 'location-card';

  const name = document.createElement('div');
  name.className = 'location-name';
  name.textContent = formatLocationName(location);

  const details = document.createElement('div');
  details.className = 'location-details';

  // Country
  const country = getCountryName(location.country);
  details.appendChild(createDetailElement('🌍', country));

  // Coordinates
  const coords = `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  details.appendChild(createDetailElement('📍', coords));

  // Population (if available)
  if (location.pop && location.pop > 0) {
    const pop = formatNumber(location.pop);
    details.appendChild(createDetailElement('👥', pop));
  }

  card.appendChild(name);
  card.appendChild(details);

  return card;
}

/**
 * Create a detail element (icon + text)
 */
function createDetailElement(icon, text) {
  const detail = document.createElement('div');
  detail.className = 'location-detail';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'detail-icon';
  iconSpan.textContent = icon;

  const textSpan = document.createElement('span');
  textSpan.textContent = text;

  detail.appendChild(iconSpan);
  detail.appendChild(textSpan);

  return detail;
}

/**
 * Format location name
 */
function formatLocationName(location) {
  let name = location.name;
  const country = getCountryName(location.country);

  return `${name}, ${country}`;
}

/**
 * Get country name from code
 */
function getCountryName(code) {
  return COUNTRY_NAMES[code] || code;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toLocaleString();
}

/**
 * Handle export to CSV
 */
function handleExport() {
  if (currentLocations.length === 0) {
    alert('No locations to export');
    return;
  }

  console.log('📤 Exporting to CSV...');

  try {
    const csv = generateCSV(currentLocations);
    downloadCSV(csv, 'locations.csv');

    // Show success message (could be improved with a toast notification)
    elements.status.textContent = `Exported ${currentLocations.length} locations`;
    setTimeout(() => {
      elements.status.textContent = `Found ${currentLocations.length} location${currentLocations.length !== 1 ? 's' : ''}`;
    }, 3000);
  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export: ' + error.message);
  }
}

/**
 * Generate CSV from locations
 */
function generateCSV(locations) {
  const headers = ['Name', 'Country', 'State/Region', 'Latitude', 'Longitude', 'Population'];

  const rows = locations.map(loc => [
    loc.name,
    getCountryName(loc.country),
    loc.admin1 || '',
    loc.lat,
    loc.lng,
    loc.pop || '',
  ]);

  // Build CSV
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ];

  return csvLines.join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  console.log(`✅ Downloaded ${filename}`);
}

/**
 * Show country selection options (sorted by frequency, top 10)
 */
function showCountrySelection(options) {
  if (!options || options.length === 0) {
    hideDownloadSuggestions();
    return;
  }

  console.log(`📊 Showing ${options.length} country options (sorted by frequency)`);

  // Clear previous checkboxes
  elements.countryCheckboxes.innerHTML = '';

  // Create checkbox for each country (already sorted by frequency)
  options.forEach(({ countryCode, countryName, hitCount, isDownloaded }) => {
    const checkbox = document.createElement('div');
    checkbox.className = 'country-checkbox';

    const downloadStatus = isDownloaded ? '<span style="opacity: 0.7; font-size: 12px;"> ✓ cached</span>' : '';
    const hitDisplay = hitCount > 1 ? ` <span style="opacity: 0.7; font-size: 12px;">(${hitCount} hits)</span>` : '';

    checkbox.innerHTML = `
      <input type="checkbox" id="country-${countryCode}" value="${countryCode}" checked>
      <label for="country-${countryCode}">
        ${countryName} (${countryCode})${hitDisplay}${downloadStatus}
      </label>
    `;
    elements.countryCheckboxes.appendChild(checkbox);
  });

  // Update button text based on download needs
  const needsDownload = options.filter(o => !o.isDownloaded).length;
  if (needsDownload > 0) {
    elements.downloadSelectedBtn.innerHTML = `<span>⬇️</span> Download & Scan (${needsDownload} new)`;
  } else {
    elements.downloadSelectedBtn.innerHTML = '<span>🔍</span> Scan Selected Countries';
  }

  // Show the selection panel
  elements.downloadSuggestions.style.display = 'block';
}

/**
 * Hide download suggestions panel
 */
function hideDownloadSuggestions() {
  if (elements.downloadSuggestions) {
    elements.downloadSuggestions.style.display = 'none';
  }
}

/**
 * Handle downloading selected countries and rescanning
 */
async function handleDownloadCountries() {
  // Get selected countries
  const checkboxes = elements.countryCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
  const selectedCountries = Array.from(checkboxes).map(cb => cb.value);

  if (selectedCountries.length === 0) {
    alert('Please select at least one country to download');
    return;
  }

  console.log(`⬇️ Downloading countries:`, selectedCountries);

  // Disable button and show progress
  elements.downloadSelectedBtn.disabled = true;
  elements.downloadSelectedBtn.innerHTML = '<span>⏳</span> Downloading...';

  try {
    // Send download request to background script
    await sendToBackground(createMessage(MESSAGE_TYPES.DOWNLOAD_COUNTRIES, {
      countryCodes: selectedCountries
    }));

    console.log('✅ Download request sent');
  } catch (error) {
    console.error('Download error:', error);
    alert(`Download failed: ${error.message}`);

    // Re-enable button
    elements.downloadSelectedBtn.disabled = false;
    elements.downloadSelectedBtn.innerHTML = '<span>⬇️</span> Download & Rescan';
  }
}

/**
 * API Key Management Functions
 */

/**
 * Save API key to chrome.storage.sync
 */
async function saveApiKey(apiKey) {
  await chrome.storage.sync.set({ 'google_maps_api_key': apiKey });
  console.log('✅ API key saved');
}

/**
 * Load API key from chrome.storage.sync
 */
async function loadApiKey() {
  const result = await chrome.storage.sync.get(['google_maps_api_key']);
  return result.google_maps_api_key || null;
}

/**
 * Validate API key format
 */
function validateApiKey(key) {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'API key is required' };
  }

  if (!key.startsWith('AIza')) {
    return { valid: false, error: 'Invalid API key format. Keys should start with "AIza"' };
  }

  if (key.length < 30) {
    return { valid: false, error: 'API key is too short. Please check your key.' };
  }

  return { valid: true };
}

/**
 * Settings Modal Functions
 */

/**
 * Setup settings modal event handlers
 */
function setupSettingsModal() {
  // Open settings modal
  elements.settingsBtn.addEventListener('click', async () => {
    console.log('⚙️ Opening settings modal');

    // Load current API key
    const apiKey = await loadApiKey();
    if (apiKey) {
      elements.apiKeyInput.value = apiKey;
    } else {
      elements.apiKeyInput.value = '';
    }

    // Clear any errors
    elements.apiKeyError.style.display = 'none';
    elements.apiKeyError.textContent = '';

    // Show modal
    elements.settingsModal.style.display = 'flex';
  });

  // Close modal - X button
  elements.closeSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'none';
  });

  // Close modal - Cancel button
  elements.cancelSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.style.display = 'none';
  });

  // Close modal - Click outside
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.style.display = 'none';
    }
  });

  // Close modal - Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.settingsModal.style.display === 'flex') {
      elements.settingsModal.style.display = 'none';
    }
  });

  // Save API key
  elements.saveSettingsBtn.addEventListener('click', async () => {
    const apiKey = elements.apiKeyInput.value.trim();

    // Validate
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      elements.apiKeyError.textContent = validation.error;
      elements.apiKeyError.style.display = 'block';
      return;
    }

    try {
      // Save to storage
      await saveApiKey(apiKey);

      // Close modal
      elements.settingsModal.style.display = 'none';

      // Show success message
      elements.status.textContent = 'API key saved successfully';
      setTimeout(() => {
        if (currentLocations.length > 0) {
          elements.status.textContent = `Found ${currentLocations.length} location${currentLocations.length !== 1 ? 's' : ''}`;
        } else {
          elements.status.textContent = 'Ready to scan';
        }
      }, 3000);
    } catch (error) {
      console.error('Error saving API key:', error);
      elements.apiKeyError.textContent = 'Failed to save API key. Please try again.';
      elements.apiKeyError.style.display = 'block';
    }
  });
}

/**
 * View Toggle Functions
 */

/**
 * Setup view toggle event handlers
 */
function setupViewToggle() {
  // Get all toggle buttons
  const toggleButtons = document.querySelectorAll('.toggle-btn');

  toggleButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const view = button.dataset.view;
      await switchView(view);
    });
  });

  // Setup retry map button
  if (elements.retryMapBtn) {
    elements.retryMapBtn.addEventListener('click', async () => {
      await switchView('map');
    });
  }
}

/**
 * Switch between list and map views
 */
async function switchView(view) {
  console.log(`🔄 Switching to ${view} view`);

  if (view === 'map') {
    // No API key needed for Leaflet/OpenStreetMap!

    // Hide list, show map container
    elements.locationsList.style.display = 'none';
    elements.mapContainer.style.display = 'block';
    elements.mapError.style.display = 'none';
    elements.mapLoading.style.display = 'flex';

    // Load iframe if not already loaded
    const mapUrl = chrome.runtime.getURL('map/map.html');
    console.log('🔍 Current iframe src:', elements.mapIframe.src);
    console.log('🔍 Should be:', mapUrl);

    if (!elements.mapIframe.src || !elements.mapIframe.src.includes('map.html')) {
      console.log('🔧 Loading map iframe...');
      mapIframeLoaded = false; // Reset the flag
      elements.mapIframe.src = mapUrl;
      console.log('📍 Iframe src set to:', elements.mapIframe.src);

      // Wait for iframe to load (with timeout)
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const checkLoaded = setInterval(() => {
          attempts++;
          console.log('⏳ Waiting for iframe... mapIframeLoaded =', mapIframeLoaded, 'attempts:', attempts);
          if (mapIframeLoaded) {
            clearInterval(checkLoaded);
            console.log('✅ Iframe loaded!');
            resolve();
          } else if (attempts > 50) { // 5 seconds timeout
            clearInterval(checkLoaded);
            console.error('❌ Iframe load timeout');
            reject(new Error('Iframe failed to load'));
          }
        }, 100);
      });
    } else {
      console.log('✅ Iframe already loaded');
    }

    // Initialize map if not already initialized
    console.log('🗺️ Map initialized?', mapInitialized);
    if (!mapInitialized) {
      console.log('🚀 Initializing Leaflet map...');
      try {
        sendMessageToMap('INIT_MAP', {}); // No API key needed for OSM
        // Loading spinner will be hidden when we receive MAP_READY message
      } catch (error) {
        console.error('❌ Error sending INIT_MAP message:', error);
        elements.mapLoading.style.display = 'none';
        elements.mapError.style.display = 'flex';
        elements.mapErrorMessage.textContent = 'Failed to initialize map';
        return;
      }
    } else {
      // Map already initialized, just display locations
      elements.mapLoading.style.display = 'none';
      if (currentLocations.length > 0) {
        elements.mapLoading.style.display = 'flex';
        sendMessageToMap('DISPLAY_LOCATIONS', { locations: currentLocations });
        // Loading spinner will be hidden when we receive LOCATIONS_DISPLAYED message
      }
    }

    currentView = 'map';
  } else {
    // Show list, hide map
    elements.locationsList.style.display = 'block';
    elements.mapContainer.style.display = 'none';
    currentView = 'list';
  }

  // Update toggle button states
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  toggleButtons.forEach(button => {
    if (button.dataset.view === view) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
