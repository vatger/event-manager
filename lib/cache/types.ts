import { TimeRange } from "@/types";
import { EndorsementResponse } from "@/lib/endorsements/types";

export interface SignupTableUser {
  cid: number;
  name: string;
  rating: string;
}

export interface Availability {
  available?: TimeRange[];
  unavailable?: TimeRange[];
}

export interface SignupChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: string;
  changedBy: number;
}

/**
 * Minimal endorsement data for event context
 * Contains only the information needed for display and decision-making
 * Does not include sensitive training history or full endorsement lists
 */
export interface EventEndorsementData {
  /** Highest group this user can control at this airport (GND/TWR/APP/CTR) */
  group: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
  /** Restrictions/notes for this endorsement (e.g., solo expiry warnings) */
  restrictions: string[];
}

/**
 * Helper function to extract minimal endorsement data from full response
 * Reduces PII exposure by discarding complete endorsement/solo/fam lists
 */
export function extractMinimalEndorsementData(
  response: EndorsementResponse
): EventEndorsementData {
  return {
    group: response.group,
    restrictions: response.restrictions
  };
}

export interface SignupTableEntry {
  id: number;
  user: SignupTableUser;
  preferredStations?: string;
  remarks: string | null;
  availability: Availability;
  /** 
   * Primary endorsement for backward compatibility
   * Based on first event airport, or null if event has no airports
   */
  endorsement: EventEndorsementData | null;
  /** Per-airport endorsements (only for event airports) */
  airportEndorsements?: Record<string, EventEndorsementData>;
  /** Airports this signup can staff (based on endorsements and opt-outs) */
  selectedAirports?: string[];
  deletedAt?: string | null;
  deletedBy?: number | null;
  modifiedAfterDeadline?: boolean;
  changeLog?: SignupChange[] | null;
  changesAcknowledged?: boolean;
  signedUpAfterDeadline?: boolean;
}

export interface SignupTableResponse {
  eventId: number;
  signups: SignupTableEntry[];
  cached: boolean;
  lastUpdate?: number; // Timestamp of last update for cache busting
}