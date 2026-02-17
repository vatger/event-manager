/**
 * Utility functions for weekly event station management
 */

export type StationGroup = 'DEL' | 'GND' | 'TWR' | 'APP' | 'CTR';

/**
 * Station hierarchy from lowest to highest
 * DEL < GND < TWR < APP < CTR
 */
export const STATION_GROUP_ORDER: StationGroup[] = ['DEL', 'GND', 'TWR', 'APP', 'CTR'];

/**
 * Extract the group from a station callsign
 * Examples:
 * - EDDN_TWR → TWR
 * - EDDM_APP → APP
 * - EDMM_S_CTR → CTR
 * - EDDF_DEL → DEL
 */
export function extractStationGroup(station: string): StationGroup | null {
  const upper = station.toUpperCase();
  
  if (upper.includes('_DEL')) return 'DEL';
  if (upper.includes('_GND')) return 'GND';
  if (upper.includes('_TWR')) return 'TWR';
  if (upper.includes('_APP')) return 'APP';
  if (upper.includes('_CTR')) return 'CTR';
  
  // Fallback: check suffix
  if (upper.endsWith('DEL')) return 'DEL';
  if (upper.endsWith('GND')) return 'GND';
  if (upper.endsWith('TWR')) return 'TWR';
  if (upper.endsWith('APP')) return 'APP';
  if (upper.endsWith('CTR')) return 'CTR';
  
  return null;
}

/**
 * Get the minimum (lowest) station group from a list of stations
 * @param stations Array of station callsigns
 * @returns The lowest station group, or null if no valid stations
 */
export function getMinimumStationGroup(stations: string[]): StationGroup | null {
  if (!stations || stations.length === 0) return null;
  
  let minRank = STATION_GROUP_ORDER.length;
  let minGroup: StationGroup | null = null;
  
  for (const station of stations) {
    const group = extractStationGroup(station);
    if (group) {
      const rank = STATION_GROUP_ORDER.indexOf(group);
      if (rank < minRank) {
        minRank = rank;
        minGroup = group;
      }
    }
  }
  
  return minGroup;
}

/**
 * Check if a user's endorsement group meets the minimum required station group
 * @param userGroup User's qualified group (GND, TWR, APP, CTR)
 * @param requiredGroup Minimum required group
 * @returns true if user can staff the required group
 */
export function canStaffStation(
  userGroup: string | null | undefined,
  requiredGroup: StationGroup | null
): boolean {
  if (!userGroup || !requiredGroup) return false;
  
  const userRank = STATION_GROUP_ORDER.indexOf(userGroup as StationGroup);
  const requiredRank = STATION_GROUP_ORDER.indexOf(requiredGroup);
  
  // User can staff if their rank is >= required rank (higher in hierarchy)
  return userRank >= requiredRank;
}

/**
 * Get a human-readable description of the station group hierarchy
 */
export function getStationGroupDescription(group: StationGroup): string {
  const descriptions: Record<StationGroup, string> = {
    DEL: 'Delivery',
    GND: 'Ground',
    TWR: 'Tower',
    APP: 'Approach',
    CTR: 'Center',
  };
  return descriptions[group] || group;
}
