/**
 * Verweise auf andere VATGER-Dienste.
 *
 * Die Adressen stehen hier zentral, damit ein Umzug einer Seite nicht durch
 * die halbe Anwendung gesucht werden muss. `{cid}` wird durch die CID ersetzt.
 */

/**
 * Controller-Info im Hauptportal.
 *
 * Beim Planen ist der Blick dorthin oft der nächste Schritt: Trainingsstand,
 * Endorsements und Historie stehen dort vollständig, während der Editor nur
 * das zeigt, was für die Besetzung nötig ist.
 *
 * Über die Umgebungsvariable NEXT_PUBLIC_CONTROLLER_INFO_URL überschreibbar,
 * falls das Portal die Adresse ändert.
 */
const CONTROLLER_INFO_TEMPLATE =
  process.env.NEXT_PUBLIC_CONTROLLER_INFO_URL ??
  "https://vatsim-germany.org/community/user/{cid}";

export function controllerInfoUrl(cid: number | string): string {
  return CONTROLLER_INFO_TEMPLATE.replace("{cid}", String(cid));
}

/** VATSIM-Statistiken zur Person (Sessions, Stunden) */
export function controllerStatsUrl(cid: number | string): string {
  return `https://stats.vatsim.net/stats/${cid}`;
}
