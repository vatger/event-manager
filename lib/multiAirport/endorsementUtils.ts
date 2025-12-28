/**
 * Endorsement-related utility functions for multi-airport events
 */

import { EndorsementResponse } from "@/lib/endorsements/types";
import { getRatingValue } from "@/utils/ratingToValue";

export interface AirportEndorsementResult {
  airport: string;
  canStaff: boolean;
  endorsement: EndorsementResponse | null;
}

/**
 * Endorsement group priority mapping
 * Higher number = higher priority
 */
export const ENDORSEMENT_GROUP_PRIORITY: Record<string, number> = {
  'CTR': 4,
  'APP': 3,
  'TWR': 2,
  'GND': 1,
  'DEL': 0,
};

/**
 * Check if an endorsement has a valid group
 * @param endorsement - Endorsement data
 * @returns true if endorsement has a valid group
 */
export function hasValidEndorsement(endorsement: { group?: string | null } | undefined): boolean {
  return endorsement?.group != null;
}

/**
 * Fetch endorsements for multiple airports in parallel
 * @param airports - Array of airport ICAO codes
 * @param userCID - User's CID
 * @param rating - User's VATSIM rating
 * @param firCode - FIR code (default: EDMM)
 * @returns Map of airport to endorsement data
 */
export async function fetchAirportEndorsements(
  airports: string[],
  userCID: number,
  rating: string,
  firCode: string = "EDMM"
): Promise<Record<string, { canStaff: boolean; endorsement: EndorsementResponse | null }>> {
  const endorsementChecks = airports.map(async (airport) => {
    try {
      const res = await fetch("/api/endorsements/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {
            userCID: Number(userCID),
            rating: getRatingValue(rating),
          },
          event: {
            airport: airport,
            fir: firCode,
          },
        }),
      });
      
      if (res.ok) {
        const data = await res.json() as EndorsementResponse;
        return { airport, canStaff: !!data.group, endorsement: data };
      }
      
      return { airport, canStaff: false, endorsement: null };
    } catch (error) {
      console.error(`Error fetching endorsement for ${airport}:`, error);
      return { airport, canStaff: false, endorsement: null };
    }
  });
  
  const results = await Promise.all(endorsementChecks);
  const endorsements: Record<string, { canStaff: boolean; endorsement: EndorsementResponse | null }> = {};
  
  results.forEach(({ airport, canStaff, endorsement }) => {
    endorsements[airport] = { canStaff, endorsement };
  });
  
  return endorsements;
}

/**
 * Get the highest endorsement group across multiple airports
 * Priority: CTR > APP > TWR > GND > DEL
 * @param airportEndorsements - Map of airport to endorsement data
 * @returns Highest endorsement group string or null
 */
export function getHighestEndorsementGroup(
  airportEndorsements?: Record<string, { group?: string | null }>
): string | null {
  if (!airportEndorsements) return null;
  
  let highestGroup: string | null = null;
  let highestPriority = -1;
  
  Object.values(airportEndorsements).forEach((endorsement) => {
    if (endorsement?.group) {
      const priority = ENDORSEMENT_GROUP_PRIORITY[endorsement.group] ?? -1;
      if (priority > highestPriority) {
        highestPriority = priority;
        highestGroup = endorsement.group;
      }
    }
  });
  
  return highestGroup;
}

/**
 * Get endorsement group for a specific airport
 * @param airport - Airport ICAO code
 * @param airportEndorsements - Map of airport to endorsement data
 * @returns Endorsement group string or null
 */
export function getAirportEndorsementGroup(
  airport: string,
  airportEndorsements?: Record<string, { group?: string | null }>
): string | null {
  if (!airportEndorsements || !airportEndorsements[airport]) return null;
  return airportEndorsements[airport]?.group ?? null;
}

/**
 * Get restrictions for a specific airport
 * @param airport - Airport ICAO code
 * @param airportEndorsements - Map of airport to endorsement data
 * @returns Array of restriction strings
 */
export function getAirportRestrictions(
  airport: string,
  airportEndorsements?: Record<string, { restrictions?: string[] }>
): string[] {
  if (!airportEndorsements || !airportEndorsements[airport]) return [];
  return airportEndorsements[airport]?.restrictions ?? [];
}
