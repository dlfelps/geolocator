/**
 * IndexedDB wrapper for GeoNames data
 */
export class GeoNamesDB {
  constructor() {
    this.dbName = 'GeoNamesDB';
    this.version = 2; // Updated for country-specific data support
    this.db = null;
    this.isReady = false;
  }

  /**
   * Initialize database and create object stores
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Database failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('✅ Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('Creating/upgrading database schema...');
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Version 1: Create cities and metadata stores
        if (oldVersion < 1) {
          // Create cities object store
          const citiesStore = db.createObjectStore('cities', { keyPath: 'geonameId' });
          citiesStore.createIndex('name', 'name', { unique: false });
          citiesStore.createIndex('asciiName', 'ascii', { unique: false });
          citiesStore.createIndex('countryCode', 'country', { unique: false });
          console.log('✅ Created cities object store with indexes');

          // Create metadata store for tracking data load status
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
          console.log('✅ Created metadata object store');
        }

        // Version 2: Add country-specific data and download cache
        if (oldVersion < 2) {
          // Create countryData object store for downloaded country-specific data
          if (!db.objectStoreNames.contains('countryData')) {
            const countryStore = db.createObjectStore('countryData', { keyPath: 'geonameId' });
            countryStore.createIndex('name', 'name', { unique: false });
            countryStore.createIndex('asciiName', 'ascii', { unique: false });
            countryStore.createIndex('countryCode', 'country', { unique: false });
            console.log('✅ Created countryData object store');
          }

          // Create downloadCache to track which countries have been downloaded
          if (!db.objectStoreNames.contains('downloadCache')) {
            const cacheStore = db.createObjectStore('downloadCache', { keyPath: 'countryCode' });
            console.log('✅ Created downloadCache object store');
          }
        }
      };
    });
  }

  /**
   * Load cities data into database (bulk insert)
   */
  async loadCities(cities) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    console.log(`Loading ${cities.length.toLocaleString()} cities into database...`);
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cities', 'metadata'], 'readwrite');
      const citiesStore = transaction.objectStore('cities');
      const metadataStore = transaction.objectStore('metadata');

      // Clear existing data first
      citiesStore.clear();

      let processed = 0;
      const batchSize = 100;

      // Process in batches for better performance
      for (let i = 0; i < cities.length; i += batchSize) {
        const batch = cities.slice(i, Math.min(i + batchSize, cities.length));

        for (const city of batch) {
          citiesStore.add(city);
          processed++;

          // Log progress every 5000 cities
          if (processed % 5000 === 0) {
            console.log(`  Loaded ${processed.toLocaleString()} / ${cities.length.toLocaleString()} cities...`);
          }
        }
      }

      // Store metadata about the load
      metadataStore.put({
        key: 'citiesLoaded',
        timestamp: Date.now(),
        count: cities.length,
      });

      transaction.oncomplete = () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Loaded ${cities.length.toLocaleString()} cities in ${elapsed}s`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('Transaction failed:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Check if cities data is already loaded
   */
  async isCitiesLoaded() {
    if (!this.isReady) return false;

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('citiesLoaded');

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * Get count of cities in database
   */
  async getCitiesCount() {
    if (!this.isReady) return 0;

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['cities'], 'readonly');
      const store = transaction.objectStore('cities');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Search cities by name (case-insensitive)
   */
  async searchByName(name) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cities'], 'readonly');
      const index = transaction.objectStore('cities').index('asciiName');
      const request = index.getAll(name.toLowerCase());

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Search cities by country code
   */
  async searchByCountry(countryCode) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cities'], 'readonly');
      const index = transaction.objectStore('cities').index('countryCode');
      const request = index.getAll(countryCode.toUpperCase());

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get city by geonameId
   */
  async getCityById(geonameId) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cities'], 'readonly');
      const store = transaction.objectStore('cities');
      const request = store.get(geonameId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all cities (use with caution - returns all records)
   */
  async getAllCities(limit = 1000) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cities'], 'readonly');
      const store = transaction.objectStore('cities');
      const request = store.getAll(null, limit);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Load country-specific data into database (bulk insert)
   */
  async loadCountryData(countryCode, cities) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    console.log(`📊 Loading ${cities.length.toLocaleString()} cities for ${countryCode}...`);
    if (cities.length > 0) {
      console.log(`📊 Sample city structure:`, cities[0]);
      console.log(`📊 Sample city ascii name: "${cities[0].ascii}"`);
      console.log(`📊 Sample city country code: "${cities[0].country}"`);
    }
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['countryData', 'downloadCache'], 'readwrite');
      const countryStore = transaction.objectStore('countryData');
      const cacheStore = transaction.objectStore('downloadCache');

      // Add all cities for this country
      for (const city of cities) {
        countryStore.put(city);
      }

      // Mark country as downloaded in cache
      cacheStore.put({
        countryCode: countryCode,
        downloadDate: new Date().toISOString(),
        cityCount: cities.length
      });

      transaction.oncomplete = () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Loaded ${cities.length.toLocaleString()} cities for ${countryCode} in ${elapsed}s`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('❌ Transaction failed:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Search country-specific data by name
   */
  async searchCountryData(name) {
    if (!this.isReady) {
      throw new Error('Database not initialized');
    }

    console.log(`🔍 Searching countryData for: "${name}" (normalized: "${name.toLowerCase()}")`);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['countryData'], 'readonly');
      const index = transaction.objectStore('countryData').index('asciiName');
      const request = index.getAll(name.toLowerCase());

      request.onsuccess = () => {
        const results = request.result || [];
        console.log(`🔍 Found ${results.length} results in countryData for "${name}"`);
        if (results.length > 0) {
          console.log(`🔍 Sample result:`, results[0]);
        }
        resolve(results);
      };

      request.onerror = () => {
        console.error(`❌ searchCountryData error:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Search both cities15000 and country-specific data
   */
  async searchAllSources(name) {
    const [citiesResults, countryResults] = await Promise.all([
      this.searchByName(name),
      this.searchCountryData(name)
    ]);

    // Combine and deduplicate by geonameId
    const combined = [...citiesResults, ...countryResults];
    const deduped = [];
    const seen = new Set();

    for (const city of combined) {
      if (!seen.has(city.geonameId)) {
        seen.add(city.geonameId);
        deduped.push(city);
      }
    }

    return deduped;
  }

  /**
   * Check if a country's data has been downloaded and actually exists in the database
   */
  async isCountryDownloaded(countryCode) {
    if (!this.isReady) return false;

    return new Promise(async (resolve) => {
      // First check if it's in the download cache
      const cacheTransaction = this.db.transaction(['downloadCache'], 'readonly');
      const cacheStore = cacheTransaction.objectStore('downloadCache');
      const cacheRequest = cacheStore.get(countryCode);

      cacheRequest.onsuccess = async () => {
        const cacheEntry = cacheRequest.result;

        if (!cacheEntry) {
          console.log(`📊 ${countryCode} not in download cache`);
          resolve(false);
          return;
        }

        // Cache says it's downloaded, but verify data actually exists
        const dataTransaction = this.db.transaction(['countryData'], 'readonly');
        const dataStore = dataTransaction.objectStore('countryData');
        const countryIndex = dataStore.index('countryCode');
        const countRequest = countryIndex.count(countryCode);

        countRequest.onsuccess = () => {
          const count = countRequest.result;
          console.log(`📊 ${countryCode} cache entry exists, but countryData has ${count} entries`);

          if (count === 0) {
            console.log(`⚠️ ${countryCode} is in cache but has no data - needs re-download`);
            resolve(false);
          } else {
            console.log(`✅ ${countryCode} has ${count} entries in database`);
            resolve(true);
          }
        };

        countRequest.onerror = () => {
          console.error(`❌ Error checking ${countryCode} data count`);
          resolve(false);
        };
      };

      cacheRequest.onerror = () => {
        resolve(false);
      };
    });
  }

  /**
   * Get list of all downloaded countries
   */
  async getDownloadedCountries() {
    if (!this.isReady) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['downloadCache'], 'readonly');
      const store = transaction.objectStore('downloadCache');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get download cache info for a country
   */
  async getCountryDownloadInfo(countryCode) {
    if (!this.isReady) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['downloadCache'], 'readonly');
      const store = transaction.objectStore('downloadCache');
      const request = store.get(countryCode);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get count of entries in country data store
   */
  async getCountryDataCount() {
    if (!this.isReady) return 0;

    return new Promise((resolve) => {
      const transaction = this.db.transaction(['countryData'], 'readonly');
      const store = transaction.objectStore('countryData');
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.isReady = false;
      console.log('Database closed');
    }
  }
}
