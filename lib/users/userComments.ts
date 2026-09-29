/**
 * Interne RMKs zu einer Person.
 *
 * Die Obergrenze gilt an jeder Stelle, an der RMKs geschrieben werden –
 * Controllerinfo, Roster-Editor –, und ist auch im Eingabefeld sichtbar. Vorher
 * erlaubte die eine Stelle 2000 Zeichen, die anderen gar keine Grenze, und die
 * Datenbankspalte fasste nur 191: Längere RMKs scheiterten erst beim Speichern
 * mit einem nichtssagenden Fehler.
 */
export const USER_COMMENT_MAX = 2000;

/** Eingabe prüfen – liefert den bereinigten Text oder eine Fehlermeldung */
export function validateUserComment(
  raw: unknown
): { ok: true; comment: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "RMK darf nicht leer sein" };
  }
  const comment = raw.trim();
  if (comment.length > USER_COMMENT_MAX) {
    return {
      ok: false,
      error: `RMK ist zu lang (${comment.length} von höchstens ${USER_COMMENT_MAX} Zeichen)`,
    };
  }
  return { ok: true, comment };
}
