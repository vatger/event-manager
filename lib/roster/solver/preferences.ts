import type { EventRosterPreference } from "@prisma/client";
import type { ControllerPreference } from "./types";

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const cs = v.trim().toUpperCase();
    if (cs && !out.includes(cs)) out.push(cs);
  }
  return out;
}

/** Datenbankzeile in die Form bringen, mit der Editor und Planer rechnen */
export function toControllerPreference(row: EventRosterPreference): ControllerPreference {
  return {
    userCID: row.userCID,
    preferredStations: stringList(row.preferredStations),
    avoidedStations: stringList(row.avoidedStations),
    maxTotalMinutes: row.maxTotalMinutes ?? null,
    excludeFromSolver: row.excludeFromSolver,
  };
}

/** Ist der Eintrag leer (dann braucht es keine Zeile)? */
export function isEmptyPreference(p: Omit<ControllerPreference, "userCID">): boolean {
  return (
    p.preferredStations.length === 0 &&
    p.avoidedStations.length === 0 &&
    p.maxTotalMinutes === null &&
    !p.excludeFromSolver
  );
}
