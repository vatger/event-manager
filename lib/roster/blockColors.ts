/**
 * Farben für freie Blöcke (Combined, Training, Pause …).
 *
 * Controller-Blöcke tragen die Farbe ihrer Stationsgruppe – die ist Teil der
 * Fachlogik und nicht frei wählbar. Freie Blöcke haben keine solche Bedeutung,
 * deshalb darf das Team sie hier selbst vergeben, um eigene Systematik
 * abzubilden (z. B. alle Trainings in einer Farbe).
 *
 * Gespeichert wird der Name, nicht die CSS-Klasse: So bleibt die Zuordnung
 * auch dann gültig, wenn sich die Gestaltung ändert. Unbekannte oder fehlende
 * Werte fallen auf die neutrale Standarddarstellung zurück.
 */

export const CUSTOM_BLOCK_COLORS = [
  "slate",
  "violet",
  "sky",
  "teal",
  "amber",
  "rose",
] as const;

export type CustomBlockColor = (typeof CUSTOM_BLOCK_COLORS)[number];

export const CUSTOM_BLOCK_COLOR_LABEL: Record<CustomBlockColor, string> = {
  slate: "Neutral",
  violet: "Violett",
  sky: "Blau",
  teal: "Türkis",
  amber: "Gelb",
  rose: "Rot",
};

/** Blockfläche inkl. Rahmen */
export const CUSTOM_BLOCK_COLOR_CLASS: Record<CustomBlockColor, string> = {
  slate: "bg-slate-500 border-slate-600",
  violet: "bg-violet-500 border-violet-600",
  sky: "bg-sky-600 border-sky-700",
  teal: "bg-teal-600 border-teal-700",
  amber: "bg-amber-500 border-amber-600",
  rose: "bg-rose-500 border-rose-600",
};

/** Punkt für Auswahlmenüs */
export const CUSTOM_BLOCK_COLOR_DOT: Record<CustomBlockColor, string> = {
  slate: "bg-slate-500",
  violet: "bg-violet-500",
  sky: "bg-sky-600",
  teal: "bg-teal-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

/**
 * Standarddarstellung ohne gewählte Farbe: schraffiert, damit freie Blöcke
 * sich auf einen Blick von besetzten Stationen unterscheiden.
 */
export const CUSTOM_BLOCK_DEFAULT_CLASS =
  "bg-station-none border-station-none [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_6px,transparent_6px_12px)]";

export function isCustomBlockColor(value: unknown): value is CustomBlockColor {
  return typeof value === "string" && (CUSTOM_BLOCK_COLORS as readonly string[]).includes(value);
}

/** Klasse für einen freien Block – fällt bei unbekanntem Wert zurück */
export function customBlockClass(color: string | null | undefined): string {
  return isCustomBlockColor(color)
    ? CUSTOM_BLOCK_COLOR_CLASS[color]
    : CUSTOM_BLOCK_DEFAULT_CLASS;
}
