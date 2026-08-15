import type { SignupTableEntry } from "@/lib/cache/types";
import type { StationGroup } from "@/lib/weeklys/stationUtils";
import type { RosterFlag } from "@/lib/roster/rosterFlags";

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
  type: "controller" | "custom";
  userCID: number | null;
  label: string | null;
  color: string | null;
  startTime: string;
  endTime: string;
}

/** Explizit eingetragener Roster-Bearbeiter */
export interface ApiRosterEditor {
  userCID: number;
  name: string;
  rating: string | null;
  addedByCID: number | null;
}

/** Snapshot-Metadaten (ohne data-Blob) */
export interface ApiSnapshot {
  id: number;
  name: string;
  createdByName: string | null;
  createdAt: string;
}

/** Interne Planungsnotiz + Markierung zu einem Controller */
export interface ApiRosterNote {
  id: number;
  userCID: number;
  note: string;
  flag: RosterFlag | null;
  authorCID: number | null;
  updatedAt: string;
}

/** Zusammengefasste Planungsinfo zu einem Controller */
export interface ControllerMark {
  note: string;
  flag: RosterFlag | null;
}

export interface ApiRoster {
  id: number;
  slotMinutes: number;
  stations: RosterStation[];
  assignments: ApiAssignment[];
  notes: ApiRosterNote[];
  /** Bewusst ausgeblendete Planungshinweise (stabile Schlüssel) */
  dismissedWarnings?: string[] | null;
}

/** Client-Modell: Zeiten als Minuten seit Event-Start (raster-freundlich) */
export interface Assignment {
  id: number;
  stationId: number;
  type: "controller" | "custom";
  userCID: number | null;
  label: string | null;
  color: string | null;
  start: number; // Minuten seit Event-Start
  end: number;   // Minuten seit Event-Start (exklusiv)
}

/**
 * Gegenoperation einer Änderung – Grundlage der Rückgängig-Funktion.
 * Bewusst die Umkehrung der Aktion und kein vollständiger Zustand: So wirkt
 * das Zurücknehmen nur auf den betroffenen Block und überschreibt nicht die
 * Arbeit anderer, die parallel am selben Plan sitzen.
 */
export type UndoEntry =
  | { kind: "created"; assignmentId: number }
  | { kind: "deleted"; snapshot: Assignment }
  | {
      kind: "updated";
      assignmentId: number;
      before: Pick<Assignment, "stationId" | "start" | "end" | "color">;
    };

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
  /** Anmeldung wurde zurückgezogen, Controller aber ggf. noch eingeplant */
  withdrawn: boolean;
}

export type WarningType =
  | "no_break_switch"
  | "long_stretch"
  | "unavailable"
  | "overlap"
  | "not_eligible"
  | "airport_excluded"
  | "withdrawn";

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
      /** null = Custom-Block */
      userCID: number | null;
    }
  | {
      kind: "resize-start" | "resize-end";
      assignmentId: number;
      start: number;
      end: number;
      stationId: number;
      userCID: number | null;
    }
  | {
      // Mehrere ausgewählte Blöcke gemeinsam in der Zeit verschieben.
      // Bewusst nur die Zeitachse: Bei Blöcken auf verschiedenen Stationen
      // gibt es kein sinnvolles gemeinsames Ziel in der Senkrechten.
      kind: "move-group";
      assignmentIds: number[];
      deltaMinutes: number;
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
