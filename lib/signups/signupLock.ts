import type { TimeRange } from "@/types";

/**
 * Anmeldungen nach dem Anmeldeschluss – nur noch in positive Richtung.
 *
 * Ab dem Anmeldeschluss plant das Eventteam mit den Anmeldungen. Wer dann
 * Zeiten streicht, Airports abwählt oder sich abmeldet, reißt Lücken in einen
 * Plan, der darauf schon aufbaut. Selbst erlaubt bleibt deshalb nur, was dem
 * Plan nicht schadet:
 *
 * - die Verfügbarkeit erweitern (nicht verfügbare Zeiten freigeben),
 * - Airports hinzufügen (Ausschlüsse zurücknehmen),
 * - Wunschposition und Remarks frei bearbeiten.
 *
 * Abmelden, Zeiten streichen und Airports abwählen laufen über das Eventteam
 * (PN im Forum an die Eventleitung), das die Anmeldung im Adminbereich
 * anpasst. Für das Eventteam gelten diese Grenzen nicht.
 *
 * Dieselben Regeln nutzen API und Anmeldeformular, damit das Formular nichts
 * anbietet, was der Server anschließend ablehnt.
 */

export const LOCKED_SIGNUP_CONTACT_HINT =
  "Wende dich dafür bitte per PN im Forum an die Eventleitung.";

export interface SignupLockEvent {
  status?: string | null;
  signupDeadline?: string | Date | null;
  startTime: string | Date;
  endTime: string | Date;
  signupSlotMinutes?: number | null;
}

export interface SignupLockState {
  availability?: unknown;
  excludedAirports?: unknown;
}

/**
 * Gelten die Grenzen? Ab dem Anmeldeschluss – und ebenso, wenn das Eventteam
 * die Anmeldung schon vorher geschlossen hat.
 */
export function isSignupLocked(event: SignupLockEvent, now: Date = new Date()): boolean {
  if (event.status && event.status !== "SIGNUP_OPEN") return true;
  return !!event.signupDeadline && now.getTime() > new Date(event.signupDeadline).getTime();
}

function parseHM(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return (h * 60 + min) % 1440;
}

function rangeList(value: unknown): TimeRange[] | null {
  return Array.isArray(value) ? (value as TimeRange[]) : null;
}

/**
 * Nicht verfügbare Minuten des Events, je Minute ab dem auf das Raster
 * abgerundeten Beginn – so wie das Formular die Zeiten anbietet.
 *
 * Maßgeblich sind die nicht verfügbaren Zeiten (daraus berechnet das Formular
 * auch die verfügbaren). Fehlen sie, aber verfügbare sind angegeben, ist alles
 * außerhalb davon nicht verfügbar.
 */
function blockedMinutes(availability: unknown, event: SignupLockEvent): Uint8Array {
  const slot = event.signupSlotMinutes && event.signupSlotMinutes > 0 ? event.signupSlotMinutes : 30;
  const startMin = Math.floor(new Date(event.startTime).getTime() / 60000 / slot) * slot;
  const endMin = Math.ceil(new Date(event.endTime).getTime() / 60000 / slot) * slot;
  const total = Math.max(0, endMin - startMin);
  const baseHM = ((startMin % 1440) + 1440) % 1440;

  const mark = (ranges: TimeRange[], into: Uint8Array) => {
    for (const r of ranges) {
      const s = parseHM(r?.start);
      const e = parseHM(r?.end);
      if (s === null || e === null) continue;
      const from = (s - baseHM + 1440) % 1440;
      let to = (e - baseHM + 1440) % 1440;
      if (to <= from) to += 1440;
      for (let m = from; m < Math.min(to, total); m++) into[m] = 1;
    }
  };

  const av = (availability ?? {}) as { available?: unknown; unavailable?: unknown };
  const unavailable = rangeList(av.unavailable);
  const available = rangeList(av.available);
  const blocked = new Uint8Array(total);
  if (unavailable) {
    mark(unavailable, blocked);
  } else if (available) {
    const free = new Uint8Array(total);
    mark(available, free);
    for (let m = 0; m < total; m++) blocked[m] = free[m] ? 0 : 1;
  }
  return blocked;
}

function airportList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((a): a is string => typeof a === "string").map((a) => a.toUpperCase());
}

/** Wird die Verfügbarkeit irgendwo eingeschränkt? */
export function restrictsAvailability(
  event: SignupLockEvent,
  before: unknown,
  after: unknown
): boolean {
  const old = blockedMinutes(before, event);
  const next = blockedMinutes(after, event);
  for (let m = 0; m < next.length; m++) {
    if (next[m] && !old[m]) return true;
  }
  return false;
}

/** Airports, die neu ausgeschlossen würden */
export function newlyExcludedAirports(before: unknown, after: unknown): string[] {
  const old = new Set(airportList(before));
  return [...new Set(airportList(after))].filter((a) => !old.has(a));
}

/**
 * Darf diese Änderung nach dem Anmeldeschluss selbst gemacht werden?
 * null = ja, sonst die Begründung für den Nutzer.
 */
export function lockedSignupViolation(
  event: SignupLockEvent,
  before: SignupLockState,
  after: SignupLockState
): string | null {
  if (after.availability !== undefined && restrictsAvailability(event, before.availability, after.availability)) {
    return `Nach dem Anmeldeschluss kannst du deine Verfügbarkeit nur noch erweitern, nicht einschränken. ${LOCKED_SIGNUP_CONTACT_HINT}`;
  }
  if (after.excludedAirports !== undefined) {
    const added = newlyExcludedAirports(before.excludedAirports, after.excludedAirports);
    if (added.length > 0) {
      return `Nach dem Anmeldeschluss kannst du Airports nur noch hinzufügen, nicht abwählen (${added.join(", ")}). ${LOCKED_SIGNUP_CONTACT_HINT}`;
    }
  }
  return null;
}
