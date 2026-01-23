import { EndorsementResponse } from "@/lib/endorsements/types";
import { TimeRange } from "@/types";

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

export interface SignupTableEntry {
  id: number;
  user: SignupTableUser;
  preferredStations?: string;
  remarks: string | null;
  excludedAirports?: string[] | null; // Airports explicitly excluded by user
  availability: Availability;
  endorsement: EndorsementResponse | null;
  airportEndorsements?: Record<string, EndorsementResponse>; // Per-airport endorsements
  selectedAirports?: string[]; // Airports this signup can staff
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