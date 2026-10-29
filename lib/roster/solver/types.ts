/**
 * Automatische Planung des Besetzungsplans – gemeinsame Typen.
 *
 * Bewusst ohne Abhängigkeiten: Dieselben Typen nutzen der Server (Vorbereitung,
 * Hintergrundlauf, API), der Rechenkern im Worker und der Editor im Browser.
 */

/** Priorität einer Station: 1 = zuerst besetzen … 5 = zuletzt, 0 = nicht automatisch */
export type StationPriority = 0 | 1 | 2 | 3 | 4 | 5;

export const DEFAULT_STATION_PRIORITY: StationPriority = 3;

/** Was das Eventteam für einen Lauf einstellt (gespeichert in EventRoster.solverConfig) */
export interface SolverConfig {
  /** Kürzeste Schicht in Minuten (hart) */
  minSessionMinutes: number;
  /** Längste Schicht in Minuten (hart) */
  maxSessionMinutes: number;
  /** Angestrebte Schichtlänge in Minuten (Ziel) */
  preferredSessionMinutes: number;
  /** Kürzeste Pause zwischen zwei Schichten derselben Person (hart) */
  minBreakMinutes: number;
  /** Längste Pause zwischen zwei Schichten derselben Person (Ziel, null = egal) */
  maxBreakMinutes: number | null;
  /** Höchstens so viel Zeit je Person insgesamt (hart, null = egal) */
  maxTotalMinutes: number | null;
  /**
   * Priorität je Station (Callsign). Fehlt eine Station, gilt
   * DEFAULT_STATION_PRIORITY. Höhere Priorität wird vollständig zuerst
   * besetzt – eine Lücke dort wiegt schwerer als jede Lücke darunter.
   */
  stationPriorities: Record<string, StationPriority>;
  /**
   * true: Bestehende Blöcke bleiben, die Planung füllt nur die Lücken.
   * false: Controller-Schichten werden neu geplant; Custom- und persönliche
   * Blöcke bleiben in jedem Fall stehen.
   */
  keepExisting: boolean;
  /** Wer Wünsche hat, kommt nur auf Wunschstationen */
  onlyPreferredStations: boolean;
  /**
   * Keine C1 und höher auf Stationen, die schon S1 besetzen dürfen (hart):
   * S1-Tower und DEL/GND außerhalb von Tier 1 – dort bleibt es lieber leer
   */
  keepC1OffS1Stations: boolean;
  /** Gewicht der Wünsche (0 = egal … 10 = sehr wichtig) */
  preferenceWeight: number;
  /** Gewicht einer gleichmäßigen Verteilung der Zeit (0 = egal … 10 = sehr wichtig) */
  fairnessWeight: number;
  /** Rechenzeit in Sekunden */
  timeLimitSeconds: number;
}

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  minSessionMinutes: 60,
  maxSessionMinutes: 120,
  preferredSessionMinutes: 90,
  minBreakMinutes: 30,
  maxBreakMinutes: null,
  maxTotalMinutes: null,
  stationPriorities: {},
  keepExisting: true,
  onlyPreferredStations: false,
  keepC1OffS1Stations: true,
  preferenceWeight: 5,
  fairnessWeight: 5,
  timeLimitSeconds: 30,
};

export const SOLVER_TIME_LIMIT_MAX = 120;

/** Obergrenzen der Minutenfelder – für solverConfigSchema und den Einstellungsdialog */
export const SOLVER_MINUTES_MAX = {
  minSessionMinutes: 480,
  maxSessionMinutes: 720,
  preferredSessionMinutes: 720,
  minBreakMinutes: 480,
  maxBreakMinutes: 1440,
  maxTotalMinutes: 1440,
} as const satisfies Partial<Record<keyof SolverConfig, number>>;

/** Gespeicherte Werte mit den Standardwerten zusammenführen */
export function resolveSolverConfig(stored: unknown): SolverConfig {
  const base = { ...DEFAULT_SOLVER_CONFIG, stationPriorities: {} };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return base;
  const s = stored as Partial<SolverConfig>;
  return {
    ...base,
    ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)),
    stationPriorities:
      s.stationPriorities && typeof s.stationPriorities === "object"
        ? { ...s.stationPriorities }
        : {},
  } as SolverConfig;
}

// ---------------------------------------------------------------------------
// Wünsche je Controller (EventRosterPreference)
// ---------------------------------------------------------------------------

export interface ControllerPreference {
  userCID: number;
  /** Wunschstationen in Rangfolge */
  preferredStations: string[];
  /** Stationen, die die Person keinesfalls besetzen will */
  avoidedStations: string[];
  /** Persönliche Obergrenze in Minuten (null = Wert des Plans) */
  maxTotalMinutes: number | null;
  /** Gar nicht automatisch einplanen */
  excludeFromSolver: boolean;
  /** Mit diesen Personen gern gleichzeitig auf benachbarten Stationen */
  partnerCids: number[];
}

// ---------------------------------------------------------------------------
// Eingabe des Rechenkerns – reine Zahlen im Slot-Raster
// ---------------------------------------------------------------------------

export interface SolverStationInput {
  /** EventRosterStation.id */
  id: number;
  callsign: string;
  /** 1–5; Stationen mit Priorität 0 werden gar nicht erst übergeben */
  priority: number;
  /** Ebene (DEL = 0, GND = 1, S1-Tower = 1,5, TWR = 2, APP = 3, CTR = 4), -1 = unbekannt */
  level: number;
  /** ICAO des Airports, null bei FIR-weiten Stationen (Center) */
  airport: string | null;
  /** Zu besetzende Slots (false = ohnehin belegt, z. B. Custom-Block) */
  open: boolean[];
}

export interface SolverControllerInput {
  cid: number;
  /** Je Slot: darf eingeplant werden (verfügbar laut Anmeldung) */
  available: boolean[];
  /** Indizes der Stationen, die die Person besetzen darf und will */
  eligible: number[];
  /** Stationsindex → Rang in der Wunschliste (0 = liebste) */
  wishRank: Record<number, number>;
  /** Hat überhaupt Wünsche angegeben */
  hasWishes: boolean;
  /**
   * Indizes der Personen, mit denen sie gern gleichzeitig auf benachbarten
   * Stationen sitzt – beidseitig eingetragen
   */
  partners: number[];
  /** Persönliche Obergrenze in Slots – ersetzt die des Plans (null = die des Plans) */
  maxTotalSlots: number | null;
  /**
   * Ebene nach Rating auf derselben Skala (S1 = 1 … C1 und höher = 4) – für
   * „niemanden verschwenden“
   */
  level: number;
  /**
   * Schon feste Blöcke der Person (bleiben stehen, zählen für die Pausen).
   * `station` ist der Index in `stations` oder null, wenn die Station nicht
   * mitgeplant wird bzw. es ein persönlicher Block ist; `counts` sagt, ob der
   * Block zur Gesamtzeit zählt (Schicht ja, „Mentor" nein). Belegt wird auf
   * ganze Slots gerundet; zur Gesamtzeit zählt `countedSlots`, die echte Länge
   * (auch Bruchteile, fehlt: end - start).
   */
  fixed: {
    start: number;
    end: number;
    station: number | null;
    counts: boolean;
    countedSlots?: number;
  }[];
}

export interface SolverInput {
  slotMinutes: number;
  slotCount: number;
  stations: SolverStationInput[];
  controllers: SolverControllerInput[];
  minSessionSlots: number;
  maxSessionSlots: number;
  preferredSessionSlots: number;
  minBreakSlots: number;
  maxBreakSlots: number | null;
  maxTotalSlots: number | null;
  preferenceWeight: number;
  fairnessWeight: number;
  timeLimitMs: number;
  seed: number;
}

// ---------------------------------------------------------------------------
// Ergebnis
// ---------------------------------------------------------------------------

/** Eine vorgeschlagene Schicht (Minuten seit Event-Start) */
export interface SolverAssignment {
  stationId: number;
  callsign: string;
  userCID: number;
  start: number;
  end: number;
}

export interface SolverStationStats {
  callsign: string;
  priority: number;
  /** Zu besetzende Minuten (ohne Custom-Blöcke) */
  openMinutes: number;
  /** Davon besetzt (bestehende und vorgeschlagene Schichten) */
  coveredMinutes: number;
  /** Unbesetzte Zeiträume in Minuten seit Event-Start */
  gaps: { start: number; end: number }[];
}

export interface SolverControllerStats {
  cid: number;
  name: string;
  minutes: number;
  sessions: number;
  /** Minuten auf Wunschstationen */
  wishMinutes: number;
  /** Hätte grundsätzlich eingeplant werden können */
  plannable: boolean;
}

export interface SolverResult {
  assignments: SolverAssignment[];
  /** Ersetzt der Vorschlag die bestehenden Controller-Schichten? */
  replacesExisting: boolean;
  /** Controller-Schichten, die beim Übernehmen entfernt werden (nur replacesExisting) */
  removedAssignmentIds: number[];
  /**
   * Stand dieser Schichten beim Lauf. Wurde eine danach noch bearbeitet,
   * bleibt sie beim Übernehmen stehen statt kommentarlos zu verschwinden.
   */
  removedAssignments: {
    id: number;
    updatedAt: string;
    /**
     * Stand beim Lauf (Minuten seit dem Event-Beginn des Laufs, nicht auf die
     * Event-Zeit gekürzt – wie im Editor) – für die Vorschau
     */
    stationId: number | null;
    userCID: number | null;
    start: number;
    end: number;
  }[];
  /**
   * Event-Beginn, auf den sich die Minuten beziehen. Wird das Event danach
   * verschoben, bleiben die Schichten trotzdem zur geplanten Uhrzeit.
   */
  eventStart: string;
  stations: SolverStationStats[];
  controllers: SolverControllerStats[];
  /** Hinweise zum Ergebnis, z. B. überschrittene Pausen */
  notes: string[];
  iterations: number;
  durationMs: number;
}

export type SolverRunStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "applied";

/** Ein Lauf, wie ihn das API an den Editor gibt */
export interface ApiSolverRun {
  id: number;
  status: SolverRunStatus;
  progress: number;
  config: SolverConfig;
  result: SolverResult | null;
  error: string | null;
  createdByCID: number | null;
  createdByName: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  appliedAt: string | null;
  /**
   * Nur beim Abruf eines einzelnen fertigen Laufs: warum er sich nicht mehr
   * übernehmen lässt (dieselbe Prüfung wie beim Übernehmen), sonst null
   */
  staleReason?: string | null;
}
