/**
 * Normalizes selected airports from unknown JSON value to string array
 */
export function normalizeSelectedAirports(selectedAirports: unknown): string[] {
  if (selectedAirports && Array.isArray(selectedAirports)) {
    return selectedAirports as string[];
  }
  return [];
}

/**
 * Normalizes and validates an airport code (ICAO)
 * @param code - The airport code to normalize
 * @returns The normalized airport code (trimmed and uppercase)
 */
export function normalizeAirportCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Validates an airport code (ICAO)
 * @param code - The airport code to validate
 * @returns True if the code is valid (4 characters)
 */
export function isValidAirportCode(code: string): boolean {
  const normalized = normalizeAirportCode(code);
  return normalized.length === 4;
}
