/**
 * Familiarisierungen für CTR-Positionen.
 *
 * Welche Sektorkenntnis eine Center-Position verlangt, pflegt der Datahub im
 * Feld `required_familiarisations` – früher stand dieselbe Zuordnung als
 * Handarbeit im Eventmanager und lief mit jedem Sektorplan aus dem Ruder.
 *
 * Die Schreibweise dort kennt Kürzel, die mit `+` in einem Eintrag stehen oder
 * als eigene Einträge nebeneinander – in beiden Fällen sind es Pflicht­
 * anforderungen, keine Alternativen: Für `["CH+SH", "WLD"]` müssen CH, SH und
 * WLD alle gehalten werden. `+` gruppiert dabei nur die Kürzel einer
 * Sammelposition, für die Prüfung macht das keinen Unterschied. Nach dem
 * Einlesen liegt das als Liste von Gruppen vor, deren Kürzel zusammen alle
 * Pflicht sind.
 */

/** Datahub-Schreibweise (`"CH+SH"`) in Gruppen mit ihren Kürzeln überführen */
export function parseRequiredFamiliarizations(raw: unknown): string[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) =>
      entry
        .split("+")
        .map((f) => f.trim().toUpperCase())
        .filter(Boolean)
    )
    .filter((list) => list.length > 0);
  return groups.length > 0 ? groups : undefined;
}

/**
 * Sektorkürzel, die sich aus gehaltenen Center-Positionen ergeben.
 *
 * Wer ein Solo auf `EDMM_STA_CTR` hat, darf den Sektor STA arbeiten – das ist
 * dieselbe Aussage wie die Familiarisierung STA, nur auf anderem Weg erteilt.
 * Dasselbe gilt für ein Endorsement auf der Position: Ohne die Sektorkenntnis
 * gäbe es das nicht. Beides zählt deshalb beim Prüfen mit.
 *
 * Positionen ohne Sektorteil (`EDWW_CTR`) liefern nichts.
 */
export function familiarizationsFromPositions(positions: string[]): string[] {
  const sectors = positions
    .map((p) => p.toUpperCase().split("_"))
    .filter((parts) => parts.length === 3 && parts[2] === "CTR")
    .map((parts) => parts[1]);
  return [...new Set(sectors)];
}

/**
 * Welche Familiarisierungen fehlen dieser Person für die Position?
 *
 * `null` heißt „keine Aussage" – der Datahub verlangt für diese Position
 * nichts. Ein leeres Array heißt „alles vorhanden". Sonst stehen darin alle
 * fehlenden Kürzel: Sämtliche vom Datahub genannten Kürzel sind Pflicht, egal
 * ob sie in einer `+`-Gruppe stehen oder als eigene Gruppe.
 */
export function missingFamiliarizations(
  required: string[][] | undefined,
  held: string[]
): string[] | null {
  if (!required || required.length === 0) return null;

  const have = new Set(held.map((f) => f.toUpperCase()));
  const needed = new Set(required.flat());
  return [...needed].filter((f) => !have.has(f));
}

/** Anforderung lesbar schreiben, z. B. „CH + SH" oder „CH + SH und WLD" */
export function describeFamiliarizations(required: string[][] | undefined): string | null {
  if (!required || required.length === 0) return null;
  return required.map((group) => group.join(" + ")).join(" und ");
}
