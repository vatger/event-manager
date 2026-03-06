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

/** Einzelne ATC-Session (für Drill-Down-Anzeige) */
export interface SessionDetail {
  /** Original-Callsign der Session */
  callsign: string;
  /** Datum/Uhrzeit der Verbindung (ISO string) */
  date: string;
  /** Dauer in Minuten */
  minutes: number;
}

export interface StationExperience {
  totalMinutes: number;
  sessionCount: number;
  lastSession?: Date;
  /** Alle Einzel-Sessions dieser Station (für Drill-Down) */
  sessions: SessionDetail[];
}

export interface ATCSessionStats {
  userCID: number;
  stationStats: Map<string, StationExperience>;
}

/** Serialisierbare Station-Statistik (JSON-kompatibel, ohne Map) */
export interface StationStat {
  station: string;
  totalMinutes: number;
  sessionCount: number;
  lastSession?: string; // ISO date string
  /** Alle Einzel-Sessions dieser Station, chronologisch absteigend */
  sessions: SessionDetail[];
}

/**
 * Gibt alle Stationen eines Nutzers sortiert nach Gesamtminuten zurück.
 * Optionales `limit` auf die Top-N begrenzen.
 */
export function getTopStations(stats: ATCSessionStats, limit?: number): StationStat[] {
  const sorted = [...stats.stationStats.entries()]
    .map(([station, exp]): StationStat => ({
      station,
      totalMinutes: exp.totalMinutes,
      sessionCount: exp.sessionCount,
      lastSession: exp.lastSession?.toISOString(),
      // Sessions chronologisch absteigend sortieren
      sessions: [...exp.sessions].sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

/**
 * Fetch ATC sessions for a user from VATGER API
 */
export async function fetchATCSessions(userCID: number): Promise<ATCSession[]> {
  try {
    const statsBaseUrl = process.env.VATGER_STATS_API ?? "https://stats.vatsim-germany.org/api/atc";
    const response = await fetch(
      `${statsBaseUrl}/${userCID}/sessions`
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
 * Normalize station callsign by removing position suffixes.
 * Empty parts (from double underscores) are filtered out first.
 *
 * Rules:
 * - CTR stations: preserve the sector name → PREFIX_SECTOR_CTR
 *   e.g. EDMM_WLD_CTR  → EDMM_WLD_CTR
 *        EDMM__WLD_CTR → EDMM_WLD_CTR  (double underscore normalized)
 * - All other stations: strip middle positional modifiers → PREFIX_POSITION
 *   e.g. EDDM_N_TWR   → EDDM_TWR
 *        EDDM_YS_TWR  → EDDM_TWR
 *        EDDM_NH_APP  → EDDM_APP
 */
export function normalizeStation(callsign: string): string {
  // Filter empty segments to handle double underscores (e.g. EDMM__WLD_CTR)
  const parts = callsign.split("_").filter((p) => p.length > 0);

  if (parts.length <= 2) {
    // e.g. EDDM_APP, EDMM_CTR → unchanged
    return parts.join("_");
  }

  const prefix = parts[0];
  const position = parts[parts.length - 1];

  // CTR stations: keep the sector name (second-to-last non-empty part)
  if (position === "CTR") {
    const sector = parts[parts.length - 2];
    return `${prefix}_${sector}_${position}`;
  }

  // All other position types: strip middle positional modifiers
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
    
    const detail: SessionDetail = {
      callsign: session.callsign,
      date: session.connected_at,
      minutes: session.minutes_online,
    };

    const existing = stationStats.get(normalizedStation);
    if (existing) {
      existing.totalMinutes += session.minutes_online;
      existing.sessionCount += 1;
      existing.sessions.push(detail);
      
      const sessionDate = new Date(session.disconnected_at);
      if (!existing.lastSession || sessionDate > existing.lastSession) {
        existing.lastSession = sessionDate;
      }
    } else {
      stationStats.set(normalizedStation, {
        totalMinutes: session.minutes_online,
        sessionCount: 1,
        lastSession: new Date(session.disconnected_at),
        sessions: [detail],
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
