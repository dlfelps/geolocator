/**
 * Map Page using Leaflet.js
 * Handles map display with OpenStreetMap tiles
 * Communicates with parent via postMessage
 */

let map = null;
let markerClusterGroup = null;
let isInitialized = false;

// UI Elements
const elements = {
  map: document.getElementById('map'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('error-message'),
};

/**
 * Initialize the map with Leaflet
 */
function initMap() {
  try {
    console.log('🗺️ Initializing Leaflet map...');
    showLoading();

    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      throw new Error('Leaflet library not loaded');
    }

    // Configure default icon paths
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        const iconUrl = chrome.runtime.getURL('lib/leaflet/images/marker-icon.png');
        const iconRetinaUrl = chrome.runtime.getURL('lib/leaflet/images/marker-icon-2x.png');
        const shadowUrl = chrome.runtime.getURL('lib/leaflet/images/marker-shadow.png');

        console.log('📍 Using chrome.runtime.getURL for icon paths');
        console.log('📍 Marker icon URLs:', { iconUrl, iconRetinaUrl, shadowUrl });

        L.Icon.Default.mergeOptions({
          iconRetinaUrl: iconRetinaUrl,
          iconUrl: iconUrl,
          shadowUrl: shadowUrl,
        });
      } else {
        console.warn('⚠️ chrome.runtime not available, using relative paths');
        // Fallback to relative paths
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: '../lib/leaflet/images/marker-icon-2x.png',
          iconUrl: '../lib/leaflet/images/marker-icon.png',
          shadowUrl: '../lib/leaflet/images/marker-shadow.png',
        });
      }
    } catch (error) {
      console.error('❌ Error configuring marker icons:', error);
    }

    // Create map instance
    map = L.map('map').setView([20, 0], 2);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Initialize marker cluster group
    markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 80,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    map.addLayer(markerClusterGroup);

    isInitialized = true;
    hideLoading();

    // Notify parent that map is ready
    sendMessage({ type: 'MAP_READY' });

    console.log('✅ Leaflet map initialized');
  } catch (error) {
    console.error('Map initialization error:', error);
    showError(error.message);
    sendMessage({ type: 'MAP_ERROR', error: error.message });
  }
}

/**
 * Display locations on map
 */
function displayLocations(locations) {
  if (!map) {
    console.error('Map not initialized');
    return;
  }

  if (!locations || locations.length === 0) {
    console.warn('No locations to display');
    return;
  }

  console.log(`📍 Adding ${locations.length} markers to map`);

  // Clear existing markers
  clearMarkers();

  // Create bounds to fit all markers
  const bounds = L.latLngBounds();

  // Create custom icon with explicit paths
  const customIcon = L.icon({
    iconUrl: chrome.runtime.getURL('lib/leaflet/images/marker-icon.png'),
    iconRetinaUrl: chrome.runtime.getURL('lib/leaflet/images/marker-icon-2x.png'),
    shadowUrl: chrome.runtime.getURL('lib/leaflet/images/marker-shadow.png'),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Create markers
  locations.forEach(location => {
    const lat = parseFloat(location.lat);
    const lng = parseFloat(location.lng);
    const latLng = L.latLng(lat, lng);

    // Create marker with custom icon
    const marker = L.marker(latLng, {
      title: location.name,
      icon: customIcon,
    });

    // Create popup content
    const popupContent = `
      <div style="font-family: sans-serif;">
        <strong style="font-size: 14px;">${location.name}</strong><br>
        <span style="font-size: 12px; color: #6b7280;">
          ${location.country ? `Country: ${location.country}<br>` : ''}
          ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}<br>
          ${location.pop ? `Population: ${location.pop.toLocaleString()}` : ''}
        </span>
      </div>
    `;

    marker.bindPopup(popupContent);

    // Add marker to cluster group
    markerClusterGroup.addLayer(marker);

    // Extend bounds
    bounds.extend(latLng);
  });

  // Fit map to show all markers
  if (locations.length === 1) {
    map.setView(bounds.getCenter(), 10);
  } else if (locations.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  console.log('✅ Markers displayed');
  sendMessage({ type: 'LOCATIONS_DISPLAYED', count: locations.length });
}

/**
 * Clear all markers
 */
function clearMarkers() {
  if (markerClusterGroup) {
    markerClusterGroup.clearLayers();
  }
}

/**
 * UI Functions
 */
function showLoading() {
  elements.loading.style.display = 'block';
  elements.error.style.display = 'none';
}

function hideLoading() {
  elements.loading.style.display = 'none';
}

function showError(message) {
  elements.loading.style.display = 'none';
  elements.error.style.display = 'block';
  elements.errorMessage.textContent = message;
}

/**
 * Send message to parent window
 */
function sendMessage(message) {
  window.parent.postMessage(message, '*');
}

/**
 * Listen for messages from parent
 */
window.addEventListener('message', async (event) => {
  console.log('📨 Map.js received postMessage:', event.data);

  const { type, data } = event.data;

  console.log('📨 Map processing message type:', type);

  switch (type) {
    case 'INIT_MAP':
      // API key no longer needed for Leaflet/OpenStreetMap
      initMap();
      break;

    case 'DISPLAY_LOCATIONS':
      displayLocations(data.locations);
      break;

    case 'CLEAR_MARKERS':
      clearMarkers();
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});

// Wait for Leaflet to load, then notify parent
window.addEventListener('load', () => {
  console.log('📄 Map page loaded');

  // Check if Leaflet loaded successfully
  if (typeof L === 'undefined') {
    console.error('❌ Leaflet failed to load');
    showError('Failed to load mapping library');
    sendMessage({ type: 'MAP_ERROR', error: 'Failed to load mapping library' });
  } else {
    console.log('✅ Leaflet loaded successfully');
    sendMessage({ type: 'MAP_PAGE_LOADED' });
  }
});
