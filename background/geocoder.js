import { normalizeText, getContext, isStopWord, deduplicateBy, getCountryName } from '../utils/format.js';
import { COUNTRY_NAMES } from '../utils/constants.js';

/**
 * Main geocoding function
 * Extracts location candidates from text and matches them against the database
 * Returns object with: { locations, detectedCountries }
 *
 * @param {string} text - Text to geocode
 * @param {Object} db - Database instance
 * @param {Object} options - Options: { detectionOnly: boolean, useCountryDataOnly: boolean }
 */
export async function geocodeText(text, db, options = {}) {
  const { detectionOnly = false, useCountryDataOnly = false, filterCountries = null } = options;

  console.log(`🔍 Starting geocoding (${detectionOnly ? 'DETECTION ONLY' : 'FULL SCAN'})...`);
  if (filterCountries) {
    console.log(`🎯 Filtering to ${filterCountries.length} countries: ${filterCountries.join(', ')}`);
  }
  const startTime = Date.now();

  // Pattern 1: Extract "City, Country" candidates
  const patternCandidates = extractCandidates(text);
  console.log(`Found ${patternCandidates.length} pattern candidates`);

  // Pattern 2: Extract capitalized words
  const wordCandidates = extractCapitalizedWords(text);
  console.log(`Found ${wordCandidates.length} capitalized word candidates`);

  // Combine all candidates
  const allCandidates = [...patternCandidates, ...wordCandidates];

  if (allCandidates.length === 0) {
    return { locations: [], detectedCountries: [] };
  }

  // DETECTION MODE: Only match to detect countries, don't return locations
  if (detectionOnly) {
    const detectedCountries = await detectCountriesFromCandidates(allCandidates, db);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Country detection complete in ${elapsed}s`);

    return {
      locations: [],
      detectedCountries: detectedCountries
    };
  }

  // FULL SCAN MODE: Match candidates against database
  const matches = await matchCandidates(allCandidates, db, useCountryDataOnly, filterCountries);
  console.log(`Matched ${matches.length} locations`);

  // Deduplicate results (same location might be mentioned multiple times)
  const deduplicated = deduplicateBy(matches, 'geonameId');
  console.log(`After deduplication: ${deduplicated.length} unique locations`);

  // Extract unique country codes from matched locations
  const detectedCountries = extractDetectedCountries(deduplicated);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Geocoding complete in ${elapsed}s`);

  return {
    locations: deduplicated,
    detectedCountries: detectedCountries
  };
}

/**
 * Extract location candidates from text
 * Pattern 1: "City, Country" format (high confidence)
 */
function extractCandidates(text) {
  const candidates = [];

  // Pattern 1: "City, Country" or "City, State/Province"
  // Matches: "Paris, France" or "New York, United States" or "Portland, Oregon"
  const pattern1 = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*),\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g;

  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const cityName = match[1].trim();
    const qualifier = match[2].trim();

    // Skip if city name is a stop word
    if (isStopWord(cityName)) {
      continue;
    }

    candidates.push({
      name: cityName,
      qualifier: qualifier,
      pattern: 'city-qualifier',
      confidence: 'high',
      context: getContext(text, match.index),
      index: match.index,
    });
  }

  console.log(`  Pattern 1 (City, Qualifier): ${candidates.length} candidates`);

  return candidates;
}

/**
 * Extract capitalized words that might be city names
 * Pattern 2: Standalone capitalized words (medium confidence)
 */
function extractCapitalizedWords(text) {
  const candidates = [];
  const seen = new Set(); // Avoid duplicates

  // Match capitalized words (1-3 words)
  // Examples: "Edinburgh", "New York", "Los Angeles"
  const pattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const word = match[1].trim();

    // Skip if already seen
    if (seen.has(word.toLowerCase())) {
      continue;
    }

    // Skip stop words and common false positives
    if (isStopWord(word) || isCommonFalsePositive(word)) {
      continue;
    }

    // Skip words that are part of a sentence (lowercase after)
    const nextChar = text[match.index + match[0].length];
    if (nextChar && nextChar.match(/[a-z]/)) {
      continue; // Likely part of a sentence
    }

    seen.add(word.toLowerCase());

    candidates.push({
      name: word,
      qualifier: null,
      pattern: 'capitalized-word',
      confidence: 'medium',
      context: getContext(text, match.index),
      index: match.index,
    });
  }

  console.log(`  Pattern 2 (Capitalized Words): ${candidates.length} candidates`);

  return candidates;
}

/**
 * Check if a word is a common false positive
 */
function isCommonFalsePositive(word) {
  const falsePositives = new Set([
    // Days and months
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
    // Common nouns that are also cities
    'Reading', 'Bath', 'Nice', 'Mobile', 'China', 'Jordan',
    'Hope', 'Liberty', 'America', 'Europe', 'Asia', 'Africa',
    'North', 'South', 'East', 'West',
    // Titles and proper nouns (not places)
    'King', 'Queen', 'Prince', 'Princess', 'Lord', 'Lady',
    'Saint', 'Roman', 'Greek', 'English', 'French', 'German',
    // Common adjectives/nouns that happen to be city names
    'First', 'Second', 'Third', 'Last', 'Great', 'Little',
    'New', 'Old', 'Early', 'Late', 'Modern', 'Ancient',
    // Common words that are also city names
    'Time', 'Date', 'Pop', 'Anthem', 'Alba',
  ]);

  return falsePositives.has(word);
}

/**
 * Detect countries from candidates (detection-only mode)
 * Quick scan using cities15000 just to identify which countries are mentioned
 * Returns countries sorted by frequency (most mentioned first), limited to top 10
 */
async function detectCountriesFromCandidates(candidates, db) {
  const countryCounts = new Map(); // Track hit count per country

  for (const candidate of candidates) {
    try {
      // Quick search in cities15000 only
      const matches = await db.searchByName(candidate.name);

      for (const match of matches) {
        if (match.country) {
          countryCounts.set(match.country, (countryCounts.get(match.country) || 0) + 1);
        }
      }
    } catch (error) {
      // Silently continue on errors during detection
    }
  }

  // Sort by frequency (descending), then alphabetically
  const sortedCountries = Array.from(countryCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // Sort by count descending
      return a[0].localeCompare(b[0]); // Then alphabetically
    })
    .slice(0, 10) // Take top 10
    .map(([code, count]) => ({ code, count }));

  console.log(`🌍 Detected ${countryCounts.size} countries from ${candidates.length} candidates`);
  console.log(`📊 Top countries by frequency:`, sortedCountries.map(c => `${c.code}(${c.count})`).join(', '));

  return sortedCountries;
}

/**
 * Match candidates against the database
 * @param {Array} candidates - Place name candidates
 * @param {Object} db - Database instance
 * @param {boolean} useCountryDataOnly - If true, search only country-specific data
 * @param {Array} filterCountries - If provided, only return matches from these countries
 */
async function matchCandidates(candidates, db, useCountryDataOnly = false, filterCountries = null) {
  const results = [];

  for (const candidate of candidates) {
    try {
      const matches = await findMatches(candidate, db, useCountryDataOnly, filterCountries);

      if (matches.length > 0) {
        // For MVP: Auto-select first match (no disambiguation)
        // In future phases, we'll implement confidence scoring and disambiguation
        results.push(matches[0]);

        console.log(`  ✓ Matched "${candidate.name}" → ${matches[0].name}, ${matches[0].country}`);
      } else {
        console.log(`  ✗ No match for "${candidate.name}${candidate.qualifier ? ', ' + candidate.qualifier : ''}"`);
      }
    } catch (error) {
      console.error(`  Error matching candidate "${candidate.name}":`, error);
    }
  }

  return results;
}

/**
 * Find database matches for a candidate
 * @param {Object} candidate - Candidate place name
 * @param {Object} db - Database instance
 * @param {boolean} useCountryDataOnly - If true, search only downloaded country data
 * @param {Array} filterCountries - If provided, only return matches from these countries
 */
async function findMatches(candidate, db, useCountryDataOnly = false, filterCountries = null) {
  // Search by city name
  let cityMatches;

  if (useCountryDataOnly) {
    // Search ONLY in downloaded country-specific data
    cityMatches = await db.searchCountryData(candidate.name);
  } else {
    // Search in both cities15000 and country-specific data
    cityMatches = await db.searchAllSources(candidate.name);
  }

  if (cityMatches.length === 0) {
    return [];
  }

  // Filter by user-selected countries if specified
  if (filterCountries && filterCountries.length > 0) {
    const countrySet = new Set(filterCountries);
    cityMatches = cityMatches.filter(match => countrySet.has(match.country));

    if (cityMatches.length === 0) {
      return [];
    }
  }

  // If candidate has a qualifier (Pattern 1), filter by it
  if (candidate.qualifier) {
    const filtered = filterByQualifier(cityMatches, candidate.qualifier);
    return filtered;
  }

  // If no qualifier (Pattern 2 - capitalized word), return matches
  // For multiple matches, prefer:
  // 1. Larger population (more likely to be mentioned)
  // 2. Limit to top 3 to avoid too many results
  const sorted = cityMatches.sort((a, b) => (b.pop || 0) - (a.pop || 0));

  // Return only the most populous match to avoid duplicates
  // (User can see all matches in future disambiguation feature)
  return sorted.slice(0, 1);
}

/**
 * Filter matches by country or state qualifier
 */
function filterByQualifier(matches, qualifier) {
  const normalizedQualifier = qualifier.toLowerCase();

  return matches.filter(match => {
    // Check if qualifier matches country code
    if (match.country.toLowerCase() === normalizedQualifier) {
      return true;
    }

    // Check if qualifier matches country name
    const countryName = getCountryName(match.country);
    if (countryName.toLowerCase() === normalizedQualifier) {
      return true;
    }

    // Check if qualifier matches any known country name variant
    for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
      if (name.toLowerCase() === normalizedQualifier && code === match.country) {
        return true;
      }
    }

    // Check if qualifier matches admin1 (state/province)
    if (match.admin1 && match.admin1.toLowerCase() === normalizedQualifier) {
      return true;
    }

    // TODO: In future phases, add state name lookup
    // For now, we only support state codes

    return false;
  });
}

/**
 * Calculate confidence score for a match (for future phases)
 * MVP: Not implemented - always returns 1.0
 */
function calculateConfidence(candidate, location, fullText) {
  // Placeholder for future implementation
  // Will implement confidence scoring in Phase 2 enhancement

  let confidence = 1.0;

  // Pattern boost
  if (candidate.pattern === 'city-qualifier') {
    confidence = 1.0; // High confidence for qualified matches
  }

  return confidence;
}

/**
 * Analyze context around a match (for future phases)
 * MVP: Not implemented
 */
function analyzeContext(context, location) {
  // Placeholder for future implementation
  // Will look for location-related keywords (in, from, to, near, etc.)

  return 0;
}

/**
 * Extract unique country codes from matched locations
 * Used to determine which country files should be suggested for download
 */
function extractDetectedCountries(locations) {
  const countryCodes = new Set();

  for (const location of locations) {
    if (location.country) {
      countryCodes.add(location.country);
    }
  }

  // Sort alphabetically for consistent display
  return Array.from(countryCodes).sort();
}

/**
 * Infer likely countries from text context
 * Looks for country name mentions even without matched cities
 */
export function inferCountriesFromContext(text) {
  const detectedCodes = new Set();

  // Search for country names in text
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    // Create regex to match country name (whole word boundary)
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(text)) {
      detectedCodes.add(code);
    }
  }

  return Array.from(detectedCodes).sort();
}
