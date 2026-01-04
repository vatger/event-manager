/**
 * CLIENT-SAFE utility functions for selectedAirports computation
 * These functions can be safely imported by client components
 */

import { parseOptOutAirports } from "./airportUtils";

/**
 * Get selected airports for display purposes on client-side
 * Used in SignupForm to show which airports user will be registered for
 * @param eventAirports - Array of airports in the event
 * @param airportEndorsements - Map of airport to endorsement/canStaff status
 * @param remarks - User's remarks (may contain !ICAO opt-outs)
 * @returns Array of airport ICAO codes the user can/will staff
 */
export function getSelectedAirportsForDisplay(
  eventAirports: string[],
  airportEndorsements: Record<string, { canStaff: boolean }>,
  remarks: string | null
): string[] {
  const optedOut = parseOptOutAirports(remarks);
  
  return eventAirports.filter(airport => 
    airportEndorsements[airport]?.canStaff && !optedOut.includes(airport)
  );
}
