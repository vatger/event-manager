/**
 * Familiarisierungen für CTR-Positionen.
 *
 * Welche Sektorkenntnis eine Center-Position verlangt, pflegt der Datahub im
 * Feld `required_familiarisations` – früher stand dieselbe Zuordnung als
 * Handarbeit im Eventmanager und lief mit jedem Sektorplan aus dem Ruder.
 *
 * Die Schreibweise dort kennt zwei Ebenen: Ein Eintrag wie `"CH+SH"` verlangt
 * beide Kürzel zusammen (eine Sammelposition deckt beide Sektoren ab), während
 * mehrere Einträge nebeneinander Alternativen sind – für `["STA", "WLD"]`
 * genügt eine der beiden. Nach dem Einlesen liegt das als Liste von
 * Alternativen vor, deren jede eine Liste geforderter Kürzel ist.
 */

/** Datahub-Schreibweise (`"CH+SH"`) in Alternativen mit ihren Kürzeln überführen */
export function parseRequiredFamiliarizations(raw: unknown): string[][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const alternatives = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) =>
      entry
        .split("+")
        .map((f) => f.trim().toUpperCase())
        .filter(Boolean)
    )
    .filter((list) => list.length > 0);
  return alternatives.length > 0 ? alternatives : undefined;
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
 * nichts. Ein leeres Array heißt „alles vorhanden". Sonst stehen darin die
 * fehlenden Kürzel, und zwar die der günstigsten Alternative: Wem für die eine
 * Variante ein Kürzel fehlt und für die andere drei, dem wird das eine gemeldet.
 */
export function missingFamiliarizations(
  required: string[][] | undefined,
  held: string[]
): string[] | null {
  if (!required || required.length === 0) return null;

  const have = new Set(held.map((f) => f.toUpperCase()));
  let best: string[] | null = null;
  for (const alternative of required) {
    const missing = alternative.filter((f) => !have.has(f));
    if (missing.length === 0) return [];
    if (best === null || missing.length < best.length) best = missing;
  }
  return best;
}

/** Anforderung lesbar schreiben, z. B. „CH + SH" oder „STA oder WLD" */
export function describeFamiliarizations(required: string[][] | undefined): string | null {
  if (!required || required.length === 0) return null;
  return required.map((alt) => alt.join(" + ")).join(" oder ");
}
