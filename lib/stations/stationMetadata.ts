/**
 * Service for managing station metadata from datahub
 * Provides quick lookup for station properties like s1_twr flag
 */

import { fetchAllStations } from "./fetchStations";
import type { Station } from "./types";

let stationsCache: Map<string, Station> | null = null;

/**
 * Get all stations as a map for quick lookup
 */
async function getStationsMap(): Promise<Map<string, Station>> {
  if (stationsCache) {
    return stationsCache;
  }

  const stations = await fetchAllStations();
  const map = new Map<string, Station>();
  
  for (const station of stations) {
    map.set(station.callsign.toUpperCase(), station);
  }
  
  stationsCache = map;
  return map;
}

/**
 * Check if a station is an S1 TWR station
 * S1 TWR stations can be staffed by controllers with GND endorsement (S1 rating)
 * 
 * @param callsign The station callsign (e.g., "EDDN_TWR")
 * @returns true if the station is marked as s1_twr in datahub
 */
export async function isS1TwrStation(callsign: string): Promise<boolean> {
  const stationsMap = await getStationsMap();
  const station = stationsMap.get(callsign.toUpperCase());
  return station?.s1Twr === true;
}

/**
 * Get station metadata by callsign
 * 
 * @param callsign The station callsign
 * @returns Station object or undefined if not found
 */
export async function getStationMetadata(callsign: string): Promise<Station | undefined> {
  const stationsMap = await getStationsMap();
  return stationsMap.get(callsign.toUpperCase());
}

/**
 * Get metadata for multiple stations
 * 
 * @param callsigns Array of station callsigns
 * @returns Map of callsign to Station metadata
 */
export async function getStationsMetadata(callsigns: string[]): Promise<Map<string, Station>> {
  const stationsMap = await getStationsMap();
  const result = new Map<string, Station>();
  
  for (const callsign of callsigns) {
    const station = stationsMap.get(callsign.toUpperCase());
    if (station) {
      result.set(callsign, station);
    }
  }
  
  return result;
}

/**
 * Clear the stations cache (useful for testing or forcing refresh)
 */
export function clearStationsCache(): void {
  stationsCache = null;
}
