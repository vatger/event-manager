import type { SignupChange, SignupTableEntry } from "@/lib/cache/types";
import { hmRangeToMinutes, rangesOverlap } from "@/lib/roster/rosterTime";

/**
 * Verbindet Anmeldungen mit dem Besetzungsplan.
 *
 * Beim Planen zählt nicht die Anmeldung allein, sondern ihr Verhältnis zum
 * bereits gebauten Plan: Wer sich abmeldet, ohne eingeplant zu sein, ist eine
 * Randnotiz – wer abgemeldet ist und noch auf einer Station steht, reißt ein
 * Loch in den Plan. Diese Datei berechnet genau diese Einordnung, damit die
 * Anmeldungsseite sie anzeigen kann, ohne den Editor zu öffnen.
 */

/** Eine Schicht aus dem Besetzungsplan (Minuten seit Event-Start) */
export interface PlannedShift {
  callsign: string;
  start: number;
  end: number;
  /** Liegt die Schicht (inzwischen) in einer als nicht verfügbar gemeldeten Zeit? */
  conflict: boolean;
}

export type PlanningAlertKind =
  | "withdrawn_scheduled"
  | "availability_conflict"
  | "changed"
  | "withdrawn"
  | "late_signup";

export type PlanningSeverity = "danger" | "warning" | "info";

export interface PlanningAlert {
  signupId: number;
  cid: number;
  name: string;
  kind: PlanningAlertKind;
  severity: PlanningSeverity;
  /** Kurzer Klartext für die Kopfzeile des Eintrags */
  headline: string;
  /** Geänderte Felder der Anmeldung (leer, wenn es um Ab-/Spätanmeldung geht) */
  changes: SignupChange[];
  /** Aktuell zugewiesene Schichten – gibt dem Hinweis sein Gewicht */
  shifts: PlannedShift[];
  /** Für den „Erledigt"-Knopf: Änderungen sind noch nicht quittiert */
  canAcknowledge: boolean;
}

/** Zuweisung, wie sie die Roster-API liefert */
export interface AlertAssignmentInput {
  stationId: number;
  userCID: number | null;
  startTime: string;
  endTime: string;
}

export interface AlertStationInput {
  id: number;
  callsign: string;
}

export interface BuildPlanningAlertsInput {
  signups: SignupTableEntry[];
  assignments: AlertAssignmentInput[];
  stations: AlertStationInput[];
  eventStart: Date;
  totalMinutes: number;
}

const SEVERITY_ORDER: Record<PlanningSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

/** Feldnamen aus dem Änderungsprotokoll in Klartext */
export const FIELD_LABEL: Record<string, string> = {
  availability: "Verfügbarkeit",
  preferredStations: "Wunschstationen",
  remarks: "Remarks",
  excludedAirports: "Ausgeschlossene Airports",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

/** Nicht verfügbare Zeiträume einer Anmeldung in Minuten seit Event-Start */
export function unavailableRanges(
  entry: SignupTableEntry,
  eventStart: Date,
  totalMinutes: number
): { start: number; end: number }[] {
  return (entry.availability?.unavailable ?? [])
    .map((r) => hmRangeToMinutes(r, eventStart, totalMinutes))
    .filter((r): r is { start: number; end: number } => r !== null);
}

/**
 * Schichten je CID aus dem Plan ziehen und gegen die Verfügbarkeit prüfen.
 * Custom-Blöcke ohne Person bleiben außen vor.
 */
export function shiftsByController(
  input: BuildPlanningAlertsInput
): Map<number, PlannedShift[]> {
  const { signups, assignments, stations, eventStart, totalMinutes } = input;
  const callsignById = new Map(stations.map((s) => [s.id, s.callsign]));
  const entryByCid = new Map(signups.map((s) => [s.user.cid, s]));
  const result = new Map<number, PlannedShift[]>();

  for (const a of assignments) {
    if (a.userCID == null) continue;
    const start = Math.round(
      (new Date(a.startTime).getTime() - eventStart.getTime()) / 60000
    );
    const end = Math.round((new Date(a.endTime).getTime() - eventStart.getTime()) / 60000);
    const entry = entryByCid.get(a.userCID);
    const blocked = entry ? unavailableRanges(entry, eventStart, totalMinutes) : [];
    const shift: PlannedShift = {
      callsign: callsignById.get(a.stationId) ?? "?",
      start,
      end,
      conflict: blocked.some((r) => rangesOverlap(start, end, r.start, r.end)),
    };
    const list = result.get(a.userCID);
    if (list) list.push(shift);
    else result.set(a.userCID, [shift]);
  }

  for (const list of result.values()) list.sort((a, b) => a.start - b.start);
  return result;
}

/**
 * Alles zusammenstellen, was die Planung nach dem Anmeldeschluss noch
 * beschäftigen muss – sortiert nach Dringlichkeit.
 */
export function buildPlanningAlerts(input: BuildPlanningAlertsInput): PlanningAlert[] {
  const shifts = shiftsByController(input);
  const alerts: PlanningAlert[] = [];

  for (const entry of input.signups) {
    const cid = entry.user.cid;
    const name = entry.user.name;
    const own = shifts.get(cid) ?? [];
    const withdrawn = Boolean(entry.deletedAt);
    const changes = (entry.changeLog ?? []).filter(Boolean);
    const unacknowledged = Boolean(entry.modifiedAfterDeadline) && !entry.changesAcknowledged;

    if (withdrawn && own.length > 0) {
      alerts.push({
        signupId: entry.id,
        cid,
        name,
        kind: "withdrawn_scheduled",
        severity: "danger",
        headline: `hat sich abgemeldet, steht aber noch ${own.length}× im Plan`,
        changes: [],
        shifts: own,
        canAcknowledge: false,
      });
      continue;
    }

    if (withdrawn) {
      alerts.push({
        signupId: entry.id,
        cid,
        name,
        kind: "withdrawn",
        severity: "info",
        headline: "hat sich abgemeldet",
        changes: [],
        shifts: [],
        canAcknowledge: false,
      });
      continue;
    }

    if (unacknowledged) {
      const conflicts = own.filter((s) => s.conflict);
      alerts.push({
        signupId: entry.id,
        cid,
        name,
        kind: conflicts.length > 0 ? "availability_conflict" : "changed",
        severity: conflicts.length > 0 ? "danger" : "warning",
        headline:
          conflicts.length > 0
            ? `hat die Anmeldung geändert – ${conflicts.length} eingeplante Schicht${
                conflicts.length === 1 ? "" : "en"
              } passt nicht mehr zur Verfügbarkeit`
            : "hat die Anmeldung nachträglich geändert",
        changes,
        shifts: own,
        canAcknowledge: true,
      });
      continue;
    }

    if (entry.signedUpAfterDeadline && own.length === 0) {
      alerts.push({
        signupId: entry.id,
        cid,
        name,
        kind: "late_signup",
        severity: "info",
        headline: "hat sich nach dem Anmeldeschluss angemeldet und ist noch nicht eingeplant",
        changes: [],
        shifts: [],
        canAcknowledge: false,
      });
    }
  }

  return alerts.sort((a, b) => {
    const d = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

/** Kennzahlen für die Kopfzeile der Anmeldungsseite */
export interface PlanningSummary {
  activeSignups: number;
  scheduled: number;
  unscheduled: number;
  plannedMinutes: number;
  openAlerts: number;
}

export function planningSummary(
  input: BuildPlanningAlertsInput,
  alerts: PlanningAlert[]
): PlanningSummary {
  const shifts = shiftsByController(input);
  const active = input.signups.filter((s) => !s.deletedAt);
  let scheduled = 0;
  let plannedMinutes = 0;
  for (const entry of active) {
    const own = shifts.get(entry.user.cid);
    if (own && own.length > 0) {
      scheduled += 1;
      plannedMinutes += own.reduce((sum, s) => sum + (s.end - s.start), 0);
    }
  }
  return {
    activeSignups: active.length,
    scheduled,
    unscheduled: active.length - scheduled,
    plannedMinutes,
    openAlerts: alerts.filter((a) => a.severity !== "info").length,
  };
}
