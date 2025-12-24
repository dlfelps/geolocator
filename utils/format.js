import { COUNTRY_NAMES } from './constants.js';

/**
 * Get full country name from country code
 */
export function getCountryName(countryCode) {
  return COUNTRY_NAMES[countryCode] || countryCode;
}

/**
 * Format a location for display
 */
export function formatLocationName(location) {
  const parts = [location.name];

  if (location.admin1) {
    parts.push(location.admin1);
  }

  const country = getCountryName(location.country);
  parts.push(country);

  return parts.join(', ');
}

/**
 * Format number with commas
 */
export function formatNumber(num) {
  if (!num) return '';
  return num.toLocaleString();
}

/**
 * Format coordinates
 */
export function formatCoordinates(lat, lng, precision = 4) {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

/**
 * Normalize text for matching
 * - Convert to lowercase
 * - Remove diacritics
 * - Normalize whitespace
 */
export function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Check if a word is a common stop word (not a place name)
 */
const STOP_WORDS = new Set([
  'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'lord', 'lady',
  'street', 'avenue', 'road', 'lane', 'drive', 'boulevard',
]);

export function isStopWord(word) {
  return STOP_WORDS.has(word.toLowerCase());
}

/**
 * Extract context around a match (for confidence scoring)
 */
export function getContext(text, index, windowSize = 50) {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(text.length, index + windowSize);
  return text.substring(start, end);
}

/**
 * Deduplicate array of objects by key
 */
export function deduplicateBy(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}
