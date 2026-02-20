/**
 * ATC Session Statistics Service
 * Fetches and processes ATC session data from VATGER API
 */

interface ATCSession {
  id: number;
  account_id: number;
  callsign: string;
  frequency: number;
  qualification_id: number;
  facility_type: number;
  connected_at: string;
  disconnected_at: string;
  minutes_online: number;
}

export interface StationExperience {
  totalMinutes: number;
  sessionCount: number;
  lastSession?: Date;
}

export interface ATCSessionStats {
  userCID: number;
  stationStats: Map<string, StationExperience>;
}

/**
 * Fetch ATC sessions for a user from VATGER API
 */
export async function fetchATCSessions(userCID: number): Promise<ATCSession[]> {
  try {
    const response = await fetch(
      `https://stats.vatsim-germany.org/api/atc/${userCID}/sessions`
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch ATC sessions for ${userCID}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching ATC sessions for ${userCID}:`, error);
    return [];
  }
}

/**
 * Normalize station callsign by removing position suffixes
 * Examples:
 * - EDDM_NH_APP -> EDDM_APP
 * - EDGG_N_CTR -> EDGG_CTR
 * - EDDM_1_TWR -> EDDM_TWR
 */
export function normalizeStation(callsign: string): string {
  const parts = callsign.split("_");

  if (parts.length <= 2) {
    // z.B. EDDM_APP oder EDMM_CTR → nichts zu tun
    return callsign;
  }

  const prefix = parts[0];
  const position = parts[parts.length - 1];

  return `${prefix}_${position}`;
}

/**
 * Get ATC statistics for a specific user
 */
export async function getUserATCStats(userCID: number): Promise<ATCSessionStats> {
  const sessions = await fetchATCSessions(userCID);
  
  const stationStats = new Map<string, StationExperience>();
  
  for (const session of sessions) {
    const normalizedStation = normalizeStation(session.callsign);
    
    const existing = stationStats.get(normalizedStation);
    if (existing) {
      existing.totalMinutes += session.minutes_online;
      existing.sessionCount += 1;
      
      const sessionDate = new Date(session.disconnected_at);
      if (!existing.lastSession || sessionDate > existing.lastSession) {
        existing.lastSession = sessionDate;
      }
    } else {
      stationStats.set(normalizedStation, {
        totalMinutes: session.minutes_online,
        sessionCount: 1,
        lastSession: new Date(session.disconnected_at),
      });
    }
  }
  
  return {
    userCID,
    stationStats,
  };
}

/**
 * Get ATC statistics for multiple users in batch (parallel fetching)
 */
export async function getUsersATCStatsBatch(
  userCIDs: number[]
): Promise<Map<number, ATCSessionStats>> {
  const statsMap = new Map<number, ATCSessionStats>();
  
  if (userCIDs.length === 0) {
    return statsMap;
  }
  
  // Fetch all users in parallel
  const promises = userCIDs.map((cid) =>
    getUserATCStats(cid).catch((error) => {
      console.error(`Failed to get ATC stats for ${cid}:`, error);
      return {
        userCID: cid,
        stationStats: new Map<string, StationExperience>(),
      };
    })
  );
  
  const results = await Promise.all(promises);
  
  for (const stats of results) {
    statsMap.set(stats.userCID, stats);
  }
  
  return statsMap;
}
