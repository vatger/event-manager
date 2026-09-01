/**
 * Gemeinsame Darstellung von Weekly-Terminen auf den öffentlichen Seiten.
 *
 * WeeklyCard und die Detailseite zeigen dieselben Angaben – Rhythmus,
 * Wochentag, Anmeldestatus. Sie liegen hier einmal, damit die Seiten nicht
 * auseinanderlaufen, wenn eine von beiden angefasst wird.
 */

import type { StatusTone } from "@/lib/events/eventDisplay";

export const WEEKDAYS_FULL = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** "Jeden Mittwoch" / "Mittwochs" – für die Karte, kurz und ohne Wochenzahl. */
export function weeklyPatternShort(weekday: number, weeksOff: number): string {
  const day = WEEKDAYS_FULL[weekday] ?? "?";
  return weeksOff === 0 ? `Jeden ${day}` : `${day}s`;
}

/** "2 Wochen aktiv, 1 Woche Pause" – für die Detailseite. */
export function weeklyPatternDetail(weeksOn: number, weeksOff: number): string {
  if (weeksOff === 0) return "Jede Woche";
  const on = `${weeksOn} ${weeksOn === 1 ? "Woche" : "Wochen"} aktiv`;
  const off = `${weeksOff} ${weeksOff === 1 ? "Woche" : "Wochen"} Pause`;
  return `${on}, ${off}`;
}

/**
 * Flughäfen eines Weeklys als Liste.
 *
 * Historisch stand das Feld gelegentlich noch als JSON-String in der API-
 * Antwort, statt schon als Array – dieser Fall wird hier mit aufgefangen.
 */
export function weeklyAirportList(airports: unknown): string[] {
  if (Array.isArray(airports)) return airports.filter(Boolean).map(String);
  if (typeof airports === "string" && airports.trim()) {
    try {
      const parsed = JSON.parse(airports);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [airports];
    } catch {
      return [airports];
    }
  }
  return [];
}

export interface OccurrenceStatusInput {
  requiresRoster: boolean;
  rosterPublished: boolean;
  /** "open" | "closed" | "auto" */
  signupStatus: string;
  /** Datum des Termins (nicht der Anmeldung) */
  date: Date;
  signupDeadline: Date | null;
}

export interface OccurrenceStatusDisplay {
  label: string;
  tone: StatusTone;
}

/**
 * Anmeldestatus eines einzelnen Weekly-Termins.
 *
 * Deckt dieselben Fälle ab wie bisher inline in der Detailseite berechnet –
 * hier nur einmal, mit einem Bedeutungston statt einer Tailwind-Klasse, die
 * über Substring-Matching wieder in eine Badge-Farbe zurückübersetzt wurde.
 */
export function occurrenceStatus(input: OccurrenceStatusInput): OccurrenceStatusDisplay {
  if (!input.requiresRoster) {
    return { label: "Kein Roster vorgesehen", tone: "neutral" };
  }

  if (input.rosterPublished) {
    return { label: "Roster veröffentlicht", tone: "highlight" };
  }

  if (input.signupStatus === "closed") {
    return { label: "Anmeldung geschlossen", tone: "neutral" };
  }

  if (input.signupStatus === "open") {
    if (input.signupDeadline && input.signupDeadline <= new Date()) {
      return { label: "Anmeldeschluss überschritten", tone: "danger" };
    }
    return { label: "Anmeldung offen", tone: "success" };
  }

  // Automatischer Modus: öffnet zwei Wochen vor dem Termin.
  const twoWeeksBefore = new Date(input.date);
  twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);

  if (new Date() < twoWeeksBefore) {
    return { label: "Noch keine Anmeldung", tone: "warning" };
  }

  if (input.signupDeadline && input.signupDeadline <= new Date()) {
    return { label: "Anmeldeschluss überschritten", tone: "danger" };
  }

  return { label: "Anmeldung offen", tone: "success" };
}
