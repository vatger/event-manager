/**
 * Airport-related utility functions for multi-airport events
 */

/**
 * Regular expression pattern for matching opted-out airports (!ICAO)
 */
const OPT_OUT_PATTERN = /!([A-Z]{4})/g;

/**
 * Parse event airports from various formats into a string array
 * @param airports - Can be string, string[], or JSON string
 * @returns Array of airport ICAO codes
 */
export function parseEventAirports(airports: any): string[] {
  if (Array.isArray(airports)) {
    return airports;
  }
  
  if (typeof airports === 'string') {
    try {
      const parsed = JSON.parse(airports);
      return Array.isArray(parsed) ? parsed : [airports];
    } catch {
      return [airports];
    }
  }
  
  return [];
}

/**
 * Parse opted-out airports from remarks using !ICAO syntax
 * @param remarks - User's remarks field
 * @returns Array of airport ICAO codes that user opted out of
 */
export function parseOptOutAirports(remarks: string | null): string[] {
  if (!remarks) return [];
  
  const matches = remarks.matchAll(OPT_OUT_PATTERN);
  return Array.from(matches, m => m[1]);
}

/**
 * Check if an airport is opted out
 * @param airport - Airport ICAO code
 * @param remarks - User's remarks field
 * @returns true if airport is opted out via !ICAO
 */
export function isAirportOptedOut(airport: string, remarks: string | null): boolean {
  const optedOut = parseOptOutAirports(remarks);
  return optedOut.includes(airport);
}
