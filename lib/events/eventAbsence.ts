/**
 * „Ich bin nicht dabei“ – Lotsen melden, dass sie zu einem Event nicht können.
 *
 * Das Eventteam unterscheidet damit „wenige Anmeldungen, weil der Termin
 * schlecht ist“ von „wenige Anmeldungen, weil das Event untergegangen ist“.
 * Die Meldung ist bewusst keine Anmeldung: Sie taucht in keiner Anmeldezahl,
 * keinem Export und keinem Plan auf.
 */

export const ABSENCE_REASON_MAX = 200;

/** Melden geht, solange die Anmeldung läuft oder geschlossen ist und das Event nicht vorbei ist */
export function canReportAbsence(
  event: { status: string; endTime: string | Date },
  now: Date = new Date()
): boolean {
  if (event.status !== "SIGNUP_OPEN" && event.status !== "SIGNUP_CLOSED") return false;
  return new Date(event.endTime).getTime() > now.getTime();
}

/** Grund bereinigen: getrimmt, leer = null; null bei zu lang → Fehler */
export function normalizeAbsenceReason(
  raw: unknown
): { ok: true; reason: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, reason: null };
  if (typeof raw !== "string") return { ok: false, error: "Ungültiger Grund" };
  const reason = raw.trim();
  if (reason.length > ABSENCE_REASON_MAX) {
    return { ok: false, error: `Der Grund darf höchstens ${ABSENCE_REASON_MAX} Zeichen lang sein.` };
  }
  return { ok: true, reason: reason || null };
}
