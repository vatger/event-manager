/**
 * Längen der Freitextfelder einer Anmeldung.
 *
 * Die Wunschposition liegt in der Datenbank als VARCHAR(191); längere
 * Eingaben scheiterten bisher erst beim Speichern mit einem allgemeinen
 * Fehler. Remarks sind TEXT (Migration 20261116010000) und bekommen eine
 * großzügige, aber feste Grenze.
 */
export const SIGNUP_PREFERRED_MAX = 191;
export const SIGNUP_REMARKS_MAX = 1000;

/** null = in Ordnung, sonst die Meldung für den Nutzer */
export function signupTextError(body: { preferredStations?: unknown; remarks?: unknown }): string | null {
  const pref = body.preferredStations;
  const remarks = body.remarks;
  if (pref != null && (typeof pref !== "string" || pref.length > SIGNUP_PREFERRED_MAX)) {
    return `Die Wunschposition darf höchstens ${SIGNUP_PREFERRED_MAX} Zeichen lang sein.`;
  }
  if (remarks != null && (typeof remarks !== "string" || remarks.length > SIGNUP_REMARKS_MAX)) {
    return `Die Bemerkungen dürfen höchstens ${SIGNUP_REMARKS_MAX} Zeichen lang sein.`;
  }
  return null;
}
