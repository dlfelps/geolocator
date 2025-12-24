/**
 * Google Maps Manager
 * Handles dynamic loading of Google Maps API and map operations
 */

class GoogleMapsLoader {
  constructor() {
    this.isLoaded = false;
    this.isLoading = false;
    this.loadPromise = null;
  }

  /**
   * Dynamically load Google Maps JavaScript API
   */
  async load(apiKey) {
    // Return existing promise if already loading
    if (this.isLoading) {
      return this.loadPromise;
    }

    // Return immediately if already loaded
    if (this.isLoaded) {
      return Promise.resolve();
    }

    this.isLoading = true;

    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded by another script
      if (window.google && window.google.maps) {
        console.log('✅ Google Maps already loaded');
        this.isLoaded = true;
        this.isLoading = false;
        resolve();
        return;
      }

      // Set up auth failure callback
      window.gm_authFailure = () => {
        console.error('❌ Google Maps authentication failed');
        this.isLoading = false;
        reject(new Error('Google Maps API authentication failed. Please check your API key.'));
      };

      // Create script tag
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('✅ Google Maps API loaded');
        this.isLoaded = true;
        this.isLoading = false;
        resolve();
      };

      script.onerror = (error) => {
        console.error('❌ Failed to load Google Maps API:', error);
        this.isLoading = false;
        reject(new Error('Failed to load Google Maps API. Check your API key and network connection.'));
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Load marker clustering library
   */
  async loadMarkerClusterer() {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.markerClusterer) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
      script.async = true;

      script.onload = () => {
        console.log('✅ Marker clusterer loaded');
        resolve();
      };

      script.onerror = (error) => {
        console.error('❌ Failed to load marker clusterer:', error);
        reject(new Error('Failed to load marker clustering library'));
      };

      document.head.appendChild(script);
    });
  }
}

class MapController {
  constructor() {
    this.map = null;
    this.markers = [];
    this.markerClusterer = null;
    this.loader = new GoogleMapsLoader();
    this.initialized = false;
    this.currentInfoWindow = null;
  }

  isInitialized() {
    return this.initialized;
  }

  /**
   * Initialize the map
   */
  async init(apiKey) {
    try {
      console.log('🗺️ Initializing map...');

      // Load Google Maps API
      await this.loader.load(apiKey);

      // Load marker clusterer
      await this.loader.loadMarkerClusterer();

      // Create map instance
      const mapElement = document.getElementById('map');
      if (!mapElement) {
        throw new Error('Map container element not found');
      }

      this.map = new google.maps.Map(mapElement, {
        zoom: 2,
        center: { lat: 20, lng: 0 }, // World center
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      this.initialized = true;
      console.log('✅ Map initialized');

      return this.map;
    } catch (error) {
      console.error('Map initialization error:', error);
      throw error;
    }
  }

  /**
   * Display locations on map with markers
   */
  async displayLocations(locations) {
    if (!this.map) {
      throw new Error('Map not initialized');
    }

    if (!locations || locations.length === 0) {
      console.warn('No locations to display');
      return;
    }

    console.log(`📍 Adding ${locations.length} markers to map`);

    // Clear existing markers
    this.clearMarkers();

    // Create bounds to fit all markers
    const bounds = new google.maps.LatLngBounds();

    // Create markers
    this.markers = locations.map(location => {
      const position = {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng)
      };

      const marker = new google.maps.Marker({
        position: position,
        map: this.map,
        title: location.name,
      });

      // Extend bounds to include this marker
      bounds.extend(position);

      return marker;
    });

    // Fit map to show all markers
    if (locations.length === 1) {
      this.map.setCenter(bounds.getCenter());
      this.map.setZoom(10);
    } else {
      this.map.fitBounds(bounds);

      // Add padding and limit max zoom
      google.maps.event.addListenerOnce(this.map, 'bounds_changed', () => {
        const zoom = this.map.getZoom();
        if (zoom > 15) this.map.setZoom(15);
      });
    }

    // Setup clustering
    this.setupClustering();

    console.log('✅ Markers displayed');
  }

  /**
   * Setup marker clustering
   */
  setupClustering() {
    if (!this.markers || this.markers.length === 0) {
      return;
    }

    // Clear existing clusterer
    if (this.markerClusterer) {
      this.markerClusterer.clearMarkers();
    }

    // Create new clusterer using the markerClusterer library
    this.markerClusterer = new markerClusterer.MarkerClusterer({
      map: this.map,
      markers: this.markers,
      algorithm: new markerClusterer.SuperClusterAlgorithm({
        radius: 100,
      }),
    });

    console.log('✅ Marker clustering enabled');
  }

  /**
   * Clear all markers from map
   */
  clearMarkers() {
    if (this.markerClusterer) {
      this.markerClusterer.clearMarkers();
      this.markerClusterer = null;
    }

    this.markers.forEach(marker => {
      marker.setMap(null);
    });

    this.markers = [];
  }

  /**
   * Destroy map instance
   */
  destroy() {
    this.clearMarkers();
    this.map = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const mapManager = new MapController();
