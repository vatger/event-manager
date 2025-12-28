/**
 * SERVER-ONLY utility functions to compute selectedAirports
 * These functions use database/server-side modules and should NOT be imported by client components
 */

import { GroupService } from "@/lib/endorsements/groupService";
import { parseOptOutAirports } from "./airportUtils";
import { hasValidEndorsement } from "./endorsementUtils";

/**
 * Compute selected airports for a user based on their endorsements and remarks (async)
 * SERVER-ONLY: Used on server-side when endorsements need to be fetched from database
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
  const optedOut = parseOptOutAirports(remarks);
  
  // Check endorsements for all event airports in parallel
  const endorsementChecks = await Promise.all(
    eventAirports.map(async (airport) => {
      const endorsement = await GroupService.getEndorsement(userCID, airport);
      const hasEndorsement = hasValidEndorsement(endorsement);
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
 * SERVER-ONLY: Used on server-side in cache layer when endorsements are pre-fetched
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
    const hasEndorsement = hasValidEndorsement(airportEndorsements[airport]);
    return hasEndorsement && !optedOut.includes(airport);
  });
}
