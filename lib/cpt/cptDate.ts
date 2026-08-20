/**
 * Termin der Training-API einlesen.
 *
 * Trägt der Zeitstempel keine Zeitzone, ist er als Zulu gemeint – ohne das
 * angehängte „Z" würde ihn JavaScript als Ortszeit lesen und der Termin damit
 * je nach Zeitzone von Server oder Browser verrutschen.
 *
 * Bewusst frei von Server-Abhängigkeiten, damit Oberfläche und Cron-Job
 * denselben Zeitpunkt errechnen.
 */
export function parseCptDate(dateString: string): Date {
  const trimmed = (dateString ?? "").trim();
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  return new Date(hasZone ? trimmed : `${trimmed.replace(" ", "T")}Z`);
}
