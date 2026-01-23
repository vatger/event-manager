/**
 * CLIENT-SAFE utility functions for selectedAirports computation
 * These functions can be safely imported by client components
 */

import { getExcludedAirports } from "./airportUtils";

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
