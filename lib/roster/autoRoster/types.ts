import type { RosterController, StationMeta } from "@/lib/roster/rosterEligibility";

/**
 * Eingaben und Ergebnisse der automatischen Roster-Planung.
 *
 * Alle Zeiten sind Minuten seit Event-Start, wie überall in der Roster-Planung
 * (siehe lib/roster/rosterTime.ts). Das Modul ist bewusst frei von React- und
 * Server-Abhängigkeiten: Der Editor plant im Browser, die Anmeldungsseite
 * prüft damit die Machbarkeit, und die Tests laufen ohne Datenbank.
 */

export interface PlanningStation {
  id: number;
  callsign: string;
  sortOrder: number;
  meta: StationMeta;
}

/**
 * Block, der beim Planen feststeht: eine bestehende Schicht, ein Custom-Block
 * auf einer Station oder ein persönlicher Block ("Mentor") in der Zeile einer
 * Person.
 */
export interface FixedBlock {
  stationId: number | null;
  userCID: number | null;
  start: number;
  end: number;
}

export interface PlanningInput {
  stations: PlanningStation[];
  /** Alle Anmeldungen – zurückgezogene werden nie eingeplant */
  controllers: RosterController[];
  fixed: FixedBlock[];
  eventAirports: string[];
  totalMinutes: number;
  slotMinutes: number;
}

export interface PlannerOptions {
  /** Kürzeste Schicht, die neu begonnen wird (außer in kürzeren Restlücken) */
  minShift: number;
  /** Längste Zeit am Stück, danach ist eine Pause fällig */
  maxShift: number;
  /** Mindestlänge einer Pause zwischen zwei Schichten */
  minBreak: number;
  /**
   * Wunschstationen aus der Anmeldung berücksichtigen: Gewünschtes wird
   * bevorzugt, ausdrücklich nicht Gewünschtes („kein DEL") nur genommen,
   * wenn es sonst nicht aufgeht.
   */
  respectPreferences: boolean;
  /** Stationen, die der Plan nicht anfasst */
  excludedStationIds: number[];
  /** Gleiche Eingabe und gleicher Seed ergeben denselben Plan */
  seed: number;
  /** Anzahl der Planungsdurchläufe; der beste gewinnt */
  iterations: number;
}

export interface PlannedAssignment {
  stationId: number;
  userCID: number;
  start: number;
  end: number;
}

export interface TimeRangeMinutes {
  start: number;
  end: number;
}

export interface UncoveredRange extends TimeRangeMinutes {
  stationId: number;
}

export interface AutoRosterResult {
  assignments: PlannedAssignment[];
  /** Offene Zeiträume der berücksichtigten Stationen nach der Planung */
  uncovered: UncoveredRange[];
  /** Zu besetzende Stationsminuten (ohne feste Blöcke) */
  openMinutes: number;
  /** Davon durch den Plan besetzt */
  coveredMinutes: number;
  /** Eingeplante Lotsenzeit je CID (nur neu geplante Blöcke) */
  minutesByCid: Record<number, number>;
  /** Einsetzbare Personen, die trotzdem keine Schicht bekommen haben */
  unassignedCids: number[];
  /** Wer auf einer ausdrücklich nicht gewünschten Station gelandet ist */
  wishConflicts: { userCID: number; callsigns: string[] }[];
}

// ---------------------------------------------------------------------
// Machbarkeit
// ---------------------------------------------------------------------

export type FeasibilityVerdict = "ok" | "tight" | "insufficient";

export interface FeasibilityGap extends TimeRangeMinutes {
  stationId: number;
  callsign: string;
  /**
   * `no_candidate`: niemand mit passender Freigabe ist verfügbar.
   * `contention`: Geeignete sind da, werden aber auf höher priorisierten
   * Stationen gebraucht.
   */
  reason: "no_candidate" | "contention";
  /** Geeignete, verfügbare Personen im Zeitraum (Minimum über die Slots) */
  candidates: number;
}

export interface CapacityShortfall {
  /** Betrachtete Ebenen, von oben gezählt – z. B. ["CTR", "APP"] */
  levels: string[];
  demandMinutes: number;
  /** Lotsenzeit, die unter Einhaltung der Pausenregel höchstens möglich ist */
  supplyMinutes: number;
  missingMinutes: number;
}

/**
 * Lage einer Besetzungsgruppe – Stationen derselben Ebene, bei Multi-Airport-
 * Events je Airport (z. B. „EDDM TWR"). Zeigt, wo es eng werden kann, auch
 * wenn der Plan insgesamt noch aufgeht.
 *
 * `short`: dort bleibt etwas unbesetzt, oder mit Pausen reicht die Zeit
 * der geeigneten Lotsen nicht. `tight`: es reicht, aber ohne Reserve – fällt
 * jemand aus, entsteht eine Lücke.
 */
export interface FeasibilityGroup {
  key: string;
  /** Anzeigename, z. B. „TWR" oder „EDDM TWR" */
  label: string;
  /** Ebene (DEL … CTR) bzw. „Sonstige" */
  level: string;
  airport: string | null;
  callsigns: string[];
  /** Zu besetzende Stationsminuten */
  demandMinutes: number;
  /**
   * Lotsenzeit der für die Gruppe geeigneten Personen mit Pausenregel –
   * ohne Abzug dafür, dass sie auch woanders gebraucht werden
   */
  supplyMinutes: number;
  /** supply / demand, null ohne Bedarf */
  ratio: number | null;
  /** Unbesetzbare Minuten aus den Momentaufnahmen (Ebenen von oben besetzt) */
  gapMinutes: number;
  /**
   * Kleinste Reserve: geeignete, verfügbare Personen, die in einem Slot
   * nirgends gebraucht werden. 0 = kein Spielraum.
   */
  minReserve: number;
  /** Zeiträume ohne Reserve (ohne die ohnehin unbesetzbaren) */
  noReserveRanges: TimeRangeMinutes[];
  status: "ok" | "tight" | "short";
}

export interface FeasibilityReport {
  verdict: FeasibilityVerdict;
  /** Zu besetzende Stationsminuten */
  demandMinutes: number;
  /** Obergrenze der besetzbaren Stationsminuten (ohne Pausenregel) */
  coverableMinutes: number;
  gaps: FeasibilityGap[];
  shortfalls: CapacityShortfall[];
  /**
   * Kleinstes Verhältnis von möglicher Lotsenzeit zu Bedarf über die
   * Ebenen von oben – unter 1 reicht es nicht, knapp darüber ist es eng.
   */
  capacityRatio: number | null;
  /** Geeignete Personen je Station über das ganze Event */
  candidatesByStation: Record<number, number>;
  /** Aktive Anmeldungen, die keine der Stationen besetzen dürfen */
  unusableCids: number[];
  /** Lage je Besetzungsgruppe, Ebenen von oben */
  groups: FeasibilityGroup[];
}
