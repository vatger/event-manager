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
  /** Personen, die nicht automatisch eingeplant werden (z. B. rot markiert) */
  excludedCids?: number[];
}

export interface PlannerOptions {
  /** Kürzeste Schicht, die neu begonnen wird (außer in kürzeren Restlücken) */
  minShift: number;
  /** Längste Zeit am Stück, danach ist eine Pause fällig */
  maxShift: number;
  /** Mindestlänge einer Pause zwischen zwei Schichten */
  minBreak: number;
  /** Wunschstationen aus der Anmeldung bevorzugen */
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
}
