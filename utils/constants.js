// Message types for communication between extension components
export const MESSAGE_TYPES = {
  // Content script → Background
  EXTRACT_TEXT: 'EXTRACT_TEXT',
  PAGE_TEXT: 'PAGE_TEXT',

  // Background → Side panel
  COUNTRY_DETECTION: 'COUNTRY_DETECTION',
  GEOCODE_RESULTS: 'GEOCODE_RESULTS',
  GEOCODE_ERROR: 'GEOCODE_ERROR',
  GEOCODE_PROGRESS: 'GEOCODE_PROGRESS',

  // Side panel → Background
  START_GEOCODING: 'START_GEOCODING',
  EXPORT_LOCATIONS: 'EXPORT_LOCATIONS',
  DOWNLOAD_COUNTRY: 'DOWNLOAD_COUNTRY',
  DOWNLOAD_COUNTRIES: 'DOWNLOAD_COUNTRIES',

  // Background → Side panel (country downloads)
  DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',
  DOWNLOAD_COMPLETE: 'DOWNLOAD_COMPLETE',
  DOWNLOAD_ERROR: 'DOWNLOAD_ERROR',

  // Database
  DB_READY: 'DB_READY',
  DB_ERROR: 'DB_ERROR',
};

// Feature classes from GeoNames
export const FEATURE_CLASSES = {
  P: 'Populated Place',
  A: 'Administrative',
  H: 'Hydrographic',
  T: 'Topographic',
  L: 'Parks/Areas',
  S: 'Structures',
};

// Country codes to country names mapping (ISO 3166-1 alpha-2)
// This is a simplified version - full version would include all 250+ countries
export const COUNTRY_NAMES = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'FR': 'France',
  'DE': 'Germany',
  'IT': 'Italy',
  'ES': 'Spain',
  'CA': 'Canada',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'JP': 'Japan',
  'CN': 'China',
  'IN': 'India',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'AR': 'Argentina',
  'RU': 'Russia',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'PL': 'Poland',
  'CZ': 'Czech Republic',
  'PT': 'Portugal',
  'GR': 'Greece',
  'TR': 'Turkey',
  'IL': 'Israel',
  'EG': 'Egypt',
  'ZA': 'South Africa',
  'KE': 'Kenya',
  'NG': 'Nigeria',
  'KR': 'South Korea',
  'TH': 'Thailand',
  'SG': 'Singapore',
  'MY': 'Malaysia',
  'ID': 'Indonesia',
  'PH': 'Philippines',
  'VN': 'Vietnam',
  'NP': 'Nepal',
  'BD': 'Bangladesh',
  'PK': 'Pakistan',
  'AF': 'Afghanistan',
  'IQ': 'Iraq',
  'IR': 'Iran',
  'SA': 'Saudi Arabia',
  'AE': 'United Arab Emirates',
  'IE': 'Ireland',
  'IS': 'Iceland',
  'NZ': 'New Zealand',
  'CL': 'Chile',
  'PE': 'Peru',
  'CO': 'Colombia',
  'VE': 'Venezuela',
  'CU': 'Cuba',
  'UY': 'Uruguay',
  'CR': 'Costa Rica',
  'PA': 'Panama',
  'HN': 'Honduras',
  'GT': 'Guatemala',
  'EC': 'Ecuador',
  'BO': 'Bolivia',
  'PY': 'Paraguay',
  'AD': 'Andorra',
  'MC': 'Monaco',
  'LI': 'Liechtenstein',
  'LU': 'Luxembourg',
  'MT': 'Malta',
  'SM': 'San Marino',
  'VA': 'Vatican City',
};

// UI constants
export const UI = {
  MAX_RESULTS: 100,
  DEBOUNCE_MS: 300,
  LOADING_DELAY_MS: 200,
};

// Performance constants
export const PERFORMANCE = {
  MAX_TEXT_LENGTH: 50000, // chars
  CHUNK_SIZE: 1000, // for processing
};

// Export formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  KML: 'kml',
  GEOJSON: 'geojson',
  TEXT: 'text',
};
