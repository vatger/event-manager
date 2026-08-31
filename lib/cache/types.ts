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
  /**
   * Jede einzelne freigegebene Ebene an diesem Airport.
   *
   * Entscheidend für die Planung: Wer APP darf, darf deshalb nicht
   * automatisch TWR oder GND – etwa wenn das T1-Endorsement des Airports
   * fehlt oder CTR über eine FIR-Freigabe kommt. Die Prüfung muss deshalb
   * gegen diese Liste laufen, nicht gegen die Rangfolge.
   */
  allowedLevels: ('DEL' | 'GND' | 'TWR' | 'APP' | 'CTR')[];
  /** Restrictions/notes for this endorsement (e.g., solo expiry warnings) */
  restrictions: string[];
  /** Familiarisierte Sektoren im FIR – nötig zur Prüfung von CTR-Positionen */
  familiarizations: string[];
  /**
   * Gehaltene Center-Freigaben.
   *
   * Tier-1-Center-Stationen (gcapStatus "1") verlangen die Freigabe für genau
   * diese Position; die Ebene CTR allein genügt dort nicht.
   */
  ctrEndorsements: string[];
  /**
   * Solo-Freigaben auf einzelnen Positionen.
   *
   * Ein Solo zählt wie die Freigabe – bei Tier 1 wie schon bei den
   * Tier-1-Airports, und der Sektorteil (`EDMM_STA_CTR`) wie die
   * Familiarisierung STA. Zugleich kennzeichnet es einen Trainee, der auf
   * genau dieser Position üben soll; deshalb bleibt es getrennt und wird in
   * der Anzeige hervorgehoben.
   */
  soloPositions: string[];
}

/**
 * Helper function to extract minimal endorsement data from full response
 * Reduces PII exposure by discarding complete endorsement/solo/fam lists
 */
export function extractMinimalEndorsementData(
  response: EndorsementResponse
): EventEndorsementData {
  const upper = (list: string[] | undefined) => [
    ...new Set((list ?? []).map((p) => p.toUpperCase())),
  ];

  return {
    group: response.group,
    allowedLevels: response.allowedLevels ?? [],
    restrictions: response.restrictions,
    familiarizations: response.familiarizations ?? [],
    ctrEndorsements: upper(response.endorsements).filter((p) => p.endsWith("_CTR")),
    soloPositions: upper(response.data?.solos),
  };
}

export interface SignupTableEntry {
  id: number;
  user: SignupTableUser;
  preferredStations?: string;
  remarks: string | null;
  excludedAirports?: string[] | null; // Airports explicitly excluded by user
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