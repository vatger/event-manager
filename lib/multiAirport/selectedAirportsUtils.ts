/**
 * CLIENT-SAFE utility functions for selectedAirports computation
 * These functions can be safely imported by client components
 */

import { parseOptOutAirports } from "./airportUtils";

/**
 * Get excluded airports from both excludedAirports field and legacy !ICAO remarks
 * @param excludedAirports - Array of excluded airports from the field
 * @param remarks - User's remarks (may contain legacy !ICAO opt-outs)
 * @returns Combined array of excluded airport ICAO codes
 */
export function getExcludedAirports(
  excludedAirports: string[] | null | undefined,
  remarks: string | null
): string[] {
  const excluded = new Set<string>();
  
  // Add from excludedAirports field (primary method)
  if (excludedAirports && Array.isArray(excludedAirports)) {
    excludedAirports.forEach(airport => excluded.add(airport));
  }
  
  // Add from legacy !ICAO remarks (backward compatibility)
  const legacyOptedOut = parseOptOutAirports(remarks);
  legacyOptedOut.forEach(airport => excluded.add(airport));
  
  return Array.from(excluded);
}

/**
 * Get selected airports for display purposes on client-side
 * Used in SignupForm to show which airports user will be registered for
 * @param eventAirports - Array of airports in the event
 * @param airportEndorsements - Map of airport to endorsement/canStaff status
 * @param excludedAirports - Array of airports explicitly excluded by user
 * @param remarks - User's remarks (may contain legacy !ICAO opt-outs)
 * @returns Array of airport ICAO codes the user can/will staff
 */
export function getSelectedAirportsForDisplay(
  eventAirports: string[],
  airportEndorsements: Record<string, { canStaff: boolean }>,
  excludedAirports: string[] | null | undefined,
  remarks: string | null
): string[] {
  const excluded = getExcludedAirports(excludedAirports, remarks);
  
  return eventAirports.filter(airport => 
    airportEndorsements[airport]?.canStaff && !excluded.includes(airport)
  );
}
