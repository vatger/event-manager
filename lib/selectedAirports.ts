/**
 * Utility functions to compute selectedAirports dynamically
 * based on endorsements and opt-outs from remarks.
 */

import { GroupService } from "@/lib/endorsements/groupService";

/**
 * Parse opted-out airports from remarks using !ICAO syntax
 */
export function parseOptOutAirports(remarks: string | null): string[] {
  if (!remarks) return [];
  const optOutPattern = /!([A-Z]{4})/g;
  const matches = remarks.matchAll(optOutPattern);
  return Array.from(matches, m => m[1]);
}

/**
 * Compute selected airports for a user based on their endorsements and remarks
 * @param userCID - User's CID
 * @param eventAirports - Array of airports in the event
 * @param remarks - User's remarks (may contain !ICAO opt-outs)
 * @returns Array of airport ICAO codes the user can/will staff
 */
export async function computeSelectedAirports(
  userCID: number,
  eventAirports: string[],
  remarks: string | null
): Promise<string[]> {
  // Parse opt-outs from remarks
  const optedOut = parseOptOutAirports(remarks);
  
  // Check endorsements for all event airports in parallel
  const endorsementChecks = await Promise.all(
    eventAirports.map(async (airport) => {
      const endorsement = await GroupService.getEndorsement(userCID, airport);
      const hasEndorsement = endorsement?.group !== null && endorsement?.group !== undefined;
      return { airport, hasEndorsement };
    })
  );
  
  // Filter to airports where user has endorsement and hasn't opted out
  const selected = endorsementChecks
    .filter(({ airport, hasEndorsement }) => hasEndorsement && !optedOut.includes(airport))
    .map(({ airport }) => airport);
  
  return selected;
}

/**
 * Compute selected airports synchronously when endorsements are already known
 * @param eventAirports - Array of airports in the event
 * @param airportEndorsements - Map of airport to endorsement data
 * @param remarks - User's remarks (may contain !ICAO opt-outs)
 * @returns Array of airport ICAO codes the user can/will staff
 */
export function computeSelectedAirportsSync(
  eventAirports: string[],
  airportEndorsements: Record<string, { group?: string | null }>,
  remarks: string | null
): string[] {
  const optedOut = parseOptOutAirports(remarks);
  
  return eventAirports.filter((airport) => {
    const hasEndorsement = airportEndorsements[airport]?.group !== null && 
                          airportEndorsements[airport]?.group !== undefined;
    return hasEndorsement && !optedOut.includes(airport);
  });
}
