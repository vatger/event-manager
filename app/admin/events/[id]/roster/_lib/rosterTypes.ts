import type { SignupTableEntry } from "@/lib/cache/types";
import type { StationGroup } from "@/lib/weeklys/stationUtils";

/** Station wie vom Roster-API geliefert */
export interface RosterStation {
  id: number;
  callsign: string;
  sortOrder: number;
}

/** Zuweisung wie vom Roster-API geliefert (Zeiten als ISO-Strings) */
export interface ApiAssignment {
  id: number;
  stationId: number;
  userCID: number;
  startTime: string;
  endTime: string;
}

/** Interne Planungsnotiz zu einem Controller */
export interface ApiRosterNote {
  id: number;
  userCID: number;
  note: string;
  authorCID: number | null;
  updatedAt: string;
}

export interface ApiRoster {
  id: number;
  slotMinutes: number;
  stations: RosterStation[];
  assignments: ApiAssignment[];
  notes: ApiRosterNote[];
}

/** Client-Modell: Zeiten als Minuten seit Event-Start (raster-freundlich) */
export interface Assignment {
  id: number;
  stationId: number;
  userCID: number;
  start: number; // Minuten seit Event-Start
  end: number;   // Minuten seit Event-Start (exklusiv)
}

/** Stationsmetadaten aus dem Datahub (bzw. Callsign-Heuristik) */
export interface StationMeta {
  group: StationGroup | null;
  airport: string | null;
  s1Twr: boolean;
}

/** Controller = aktive Anmeldung inkl. abgeleiteter Daten */
export interface RosterController {
  cid: number;
  name: string;
  rating: string;
  entry: SignupTableEntry;
  /** Nicht-verfügbare Bereiche in Minuten seit Event-Start */
  unavailable: { start: number; end: number }[];
  /** Hat der Controller überhaupt Verfügbarkeiten angegeben? */
  hasAvailability: boolean;
  /** Wunsch-Stationen (Freitext) */
  preferredStations: string;
  remarks: string | null;
}

export type WarningType = "no_break_switch" | "long_stretch" | "unavailable" | "overlap";

export interface RosterWarning {
  type: WarningType;
  userCID: number;
  assignmentIds: number[];
  message: string;
}

/** Aktive Drag-Operation für die Vorschau */
export type DragState =
  | {
      kind: "move";
      assignmentId: number;
      /** Vorschau-Werte */
      start: number;
      end: number;
      stationId: number;
      userCID: number;
    }
  | {
      kind: "resize-start" | "resize-end";
      assignmentId: number;
      start: number;
      end: number;
      stationId: number;
      userCID: number;
    }
  | {
      kind: "create";
      stationId: number;
      start: number;
      end: number;
    }
  | {
      kind: "assign-controller";
      userCID: number;
      /** aktuelles Drop-Ziel (null solange keins) */
      stationId: number | null;
      start: number | null;
      end: number | null;
    }
  | {
      kind: "reorder-station";
      stationId: number;
      /** Station, über der aktuell geschwebt wird */
      overStationId: number | null;
    };
