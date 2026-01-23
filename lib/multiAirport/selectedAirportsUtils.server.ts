/**
 * SERVER-ONLY utility functions to compute selectedAirports
 * These functions use database/server-side modules and should NOT be imported by client components
 */

import { parseOptOutAirports } from "./airportUtils";
import { hasValidEndorsement } from "./endorsementUtils";

/**
 * Get excluded airports from both excludedAirports field and legacy !ICAO remarks
 * @param excludedAirports - Array of excluded airports from the field
 * @param remarks - User's remarks (may contain legacy !ICAO opt-outs)
 * @returns Combined array of excluded airport ICAO codes
 */
function getExcludedAirports(
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
 * Compute selected airports synchronously when endorsements are already known
 * SERVER-ONLY: Used on server-side in cache layer when endorsements are pre-fetched
 * @param eventAirports - Array of airports in the event
 * @param airportEndorsements - Map of airport to endorsement data
 * @param excludedAirports - Array of airports explicitly excluded by user
 * @param remarks - User's remarks (may contain legacy !ICAO opt-outs)
 * @returns Array of airport ICAO codes the user can/will staff
 */
export function computeSelectedAirportsSync(
  eventAirports: string[],
  airportEndorsements: Record<string, { group?: string | null }>,
  excludedAirports: string[] | null | undefined,
  remarks: string | null
): string[] {
  const excluded = getExcludedAirports(excludedAirports, remarks);
  
  return eventAirports.filter((airport) => {
    const hasEndorsement = hasValidEndorsement(airportEndorsements[airport]);
    return hasEndorsement && !excluded.includes(airport);
  });
}
