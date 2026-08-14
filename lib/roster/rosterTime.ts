import type { TimeRange } from "@/types";

/**
 * Zeitrechnung der Roster-Planung.
 *
 * Alle Zeiten laufen in UTC und werden als Minuten seit Event-Start geführt –
 * das macht Raster, Überlappungen und Zeichnen zu simpler Ganzzahl-Arithmetik.
 *
 * Bewusst frei von React- und Server-Abhängigkeiten, damit Editor,
 * Anmeldungsseite und öffentliche Ansicht dieselbe Rechnung benutzen.
 */

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function minuteToDate(eventStart: Date, minute: number): Date {
  return new Date(eventStart.getTime() + minute * 60000);
}

/** Minuten seit Event-Start → "HH:mm" (UTC) */
export function minuteToHM(eventStart: Date, minute: number): string {
  const d = minuteToDate(eventStart, minute);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * "HH:mm"-Zeitraum (aus der Anmeldung) → Minuten relativ zum Event-Start.
 * Zeiten vor dem Event-Start werden als "nach Mitternacht" interpretiert,
 * damit Events über Mitternacht funktionieren.
 */
export function hmRangeToMinutes(
  range: TimeRange,
  eventStart: Date,
  totalMinutes: number
): { start: number; end: number } | null {
  const startHM = parseHM(range.start);
  const endHM = parseHM(range.end);
  if (startHM === null || endHM === null) return null;

  const eventStartHM = eventStart.getUTCHours() * 60 + eventStart.getUTCMinutes();
  let rel = (((startHM - eventStartHM) % 1440) + 1440) % 1440;
  let relEnd = (((endHM - eventStartHM) % 1440) + 1440) % 1440;
  if (relEnd <= rel) relEnd += 1440;

  // komplett außerhalb des Events
  if (rel >= totalMinutes) return null;
  rel = Math.max(0, rel);
  relEnd = Math.min(totalMinutes, relEnd);
  if (relEnd <= rel) return null;
  return { start: rel, end: relEnd };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

/** Überlappen sich zwei Zeiträume? */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}
