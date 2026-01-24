/**
 * SERVER-ONLY utility functions to compute selectedAirports
 * These functions use database/server-side modules and should NOT be imported by client components
 */

import { getExcludedAirports } from "./airportUtils";
import { hasValidEndorsement } from "./endorsementUtils";

/**
 * Compute selected airports synchronously when endorsements are already known
 * SERVER-ONLY: Used on server-side in cache layer when endorsements are pre-fetched
 * @param eventAirports - Array of airports in the event
 * @param airportEndorsements - Map of airport to endorsement data
 * @param excludedAirports - Array of airports explicitly excluded by user
 * @returns Array of airport ICAO codes the user can/will staff
 */
export function computeSelectedAirportsSync(
  eventAirports: string[],
  airportEndorsements: Record<string, { group?: string | null }>,
  excludedAirports: string[] | null | undefined
): string[] {
  const excluded = getExcludedAirports(excludedAirports);
  
  return eventAirports.filter((airport) => {
    const hasEndorsement = hasValidEndorsement(airportEndorsements[airport]);
    return hasEndorsement && !excluded.includes(airport);
  });
}
