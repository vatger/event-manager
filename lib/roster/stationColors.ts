import type { StationGroup } from "@/lib/weeklys/stationUtils";

/**
 * Farben der Besetzungsblöcke.
 *
 * Bei Events über mehrere Airports reicht eine Farbe je Ebene nicht: Alle
 * Grounds sähen gleich aus, egal ob München oder Frankfurt – und genau die
 * Zuordnung zum Airport ist beim Überfliegen des Plans die wichtigere. Dort
 * bestimmt darum der Airport den Farbton und die Ebene die Helligkeit.
 *
 * Bei einem Single-Airport-Event gibt es diese Unterscheidung nicht – dafür
 * ist dort wichtiger, die Ebenen (Delivery, Ground, Turm, …) auf einen Blick
 * auseinanderzuhalten. Also dreht sich die Zuordnung um: Die Ebene bestimmt
 * den Farbton, einzelne Stationen derselben Ebene (z. B. zwei Delivery-
 * Positionen) unterscheiden sich nur noch in der Helligkeit.
 *
 * Die Farben entstehen in oklch, weil dort gleiche Helligkeitsschritte auch
 * gleich stark wirken – in HSL würde Gelb bei gleicher Zahl deutlich heller
 * erscheinen als Blau.
 */

/** Farbtöne für Airports, in der Reihenfolge ihrer Vergabe */
const AIRPORT_HUES = [250, 25, 160, 300, 65, 195, 130, 340, 90, 215];

/** Helligkeit je Ebene – von hell (DEL) nach dunkel (CTR) */
const LEVEL_LIGHTNESS: Record<StationGroup, number> = {
  DEL: 0.74,
  GND: 0.66,
  TWR: 0.58,
  APP: 0.50,
  CTR: 0.42,
};

/** Farbtöne für Ebenen – nur bei Single-Airport-Events genutzt */
const GROUP_HUES: Record<StationGroup, number> = {
  DEL: 210,
  GND: 145,
  TWR: 40,
  APP: 300,
  CTR: 0,
};

/** Helligkeitsspanne, über die sich Stationen derselben Ebene abstufen */
const RANK_LIGHTNESS_MIN = 0.42;
const RANK_LIGHTNESS_MAX = 0.76;

const CHROMA = 0.115;

/** Ab dieser Helligkeit trägt die Fläche dunkle statt weißer Schrift */
const DARK_TEXT_FROM = 0.66;

export interface BlockColors {
  background: string;
  border: string;
  /** Passende Schriftfarbe für ausreichenden Kontrast */
  text: string;
}

/** Position einer Station innerhalb ihrer Ebene, für die Abstufung bei Single-Airport-Events */
export interface StationRank {
  index: number;
  count: number;
}

function neutralColors(lightness: number): BlockColors {
  return {
    background: `oklch(${lightness} 0.02 260)`,
    border: `oklch(${lightness - 0.08} 0.02 260)`,
    text: lightness >= DARK_TEXT_FROM ? "oklch(0.25 0.02 260)" : "#fff",
  };
}

function huedColors(hue: number, lightness: number): BlockColors {
  return {
    background: `oklch(${lightness} ${CHROMA} ${hue})`,
    border: `oklch(${Math.max(0.2, lightness - 0.1)} ${CHROMA} ${hue})`,
    text: lightness >= DARK_TEXT_FROM ? `oklch(0.28 ${CHROMA} ${hue})` : "#fff",
  };
}

/** Helligkeit einer von mehreren Stationen derselben Ebene, gleichmäßig über die Spanne verteilt */
function rankLightness(rank: StationRank | undefined): number {
  if (!rank || rank.count <= 1) return (RANK_LIGHTNESS_MIN + RANK_LIGHTNESS_MAX) / 2;
  return (
    RANK_LIGHTNESS_MAX -
    (rank.index / (rank.count - 1)) * (RANK_LIGHTNESS_MAX - RANK_LIGHTNESS_MIN)
  );
}

/**
 * Farbton eines Airports.
 *
 * Die Reihenfolge der Event-Airports bestimmt die Vergabe, damit derselbe
 * Airport innerhalb eines Events immer dieselbe Farbe hat. Airports außerhalb
 * der Liste (etwa FIR-weite Center-Stationen) bekommen einen stabilen Ton aus
 * ihrem Namen, damit sie sich wenigstens untereinander unterscheiden.
 */
function airportHue(airport: string | null, eventAirports: string[]): number | null {
  if (!airport) return null;
  const index = eventAirports.findIndex((a) => a.toUpperCase() === airport.toUpperCase());
  if (index >= 0) return AIRPORT_HUES[index % AIRPORT_HUES.length];

  let hash = 0;
  for (let i = 0; i < airport.length; i++) hash = (hash * 31 + airport.charCodeAt(i)) % 360;
  return hash;
}

/**
 * Farben eines Controller-Blocks.
 *
 * `stationRank` gibt an, die wievielte von wie vielen Stationen derselben
 * Ebene das ist – nötig für die Abstufung bei Single-Airport-Events, wird bei
 * Multi-Airport-Events ignoriert.
 */
export function stationBlockColors(
  airport: string | null,
  group: StationGroup | null,
  eventAirports: string[],
  stationRank?: StationRank
): BlockColors {
  const singleAirport = eventAirports.length <= 1;

  if (singleAirport) {
    // Ein Airport, keine Verwechslungsgefahr mehr zwischen Plätzen – jetzt
    // trägt die Ebene die Farbe, die einzelne Station die Abstufung.
    if (!group) return neutralColors(rankLightness(stationRank));
    return huedColors(GROUP_HUES[group], rankLightness(stationRank));
  }

  const hue = airportHue(airport, eventAirports);
  const lightness = group ? LEVEL_LIGHTNESS[group] : 0.6;

  // Ohne Airport-Bezug (FIR-weite Stationen) bleibt es bewusst neutral grau,
  // damit die farbigen Airports nicht an Aussagekraft verlieren.
  if (hue === null) return neutralColors(lightness);

  return huedColors(hue, lightness);
}

/** Dezente Fläche für Zeilenköpfe und Chips desselben Airports */
export function airportTintColors(
  airport: string | null,
  eventAirports: string[],
  darkMode: boolean = false
): { background: string; border: string } {
  const hue = airportHue(airport, eventAirports);

  if (darkMode) {
    if (hue === null) {
      return { background: "oklch(0.25 0.01 260)", border: "oklch(0.35 0.01 260)" };
    }
    return {
      background: `oklch(0.25 0.03 ${hue})`,
      border: `oklch(0.38 0.06 ${hue})`,
    };
  } else {
    if (hue === null) {
      return { background: "oklch(0.95 0.01 260)", border: "oklch(0.85 0.01 260)" };
    }
    return {
      background: `oklch(0.95 0.03 ${hue})`,
      border: `oklch(0.82 0.06 ${hue})`,
    };
  }
}
