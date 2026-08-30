import type { StationGroup } from "@/lib/weeklys/stationUtils";

/**
 * Farben der Besetzungsblöcke.
 *
 * Eine Farbe je Stationsgruppe reicht bei Events über mehrere Airports nicht:
 * Alle Grounds sehen gleich aus, egal ob München oder Frankfurt – und genau
 * die Zuordnung zum Airport ist beim Überfliegen des Plans die wichtigere.
 *
 * Deshalb bestimmt der Airport den Farbton und die Ebene die Helligkeit:
 * Delivery hell, Center dunkel. Ein Blick genügt für „welcher Airport" und
 * „welche Ebene", ohne dass man Callsigns lesen muss.
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

const CHROMA = 0.115;

/** Ab dieser Helligkeit trägt die Fläche dunkle statt weißer Schrift */
const DARK_TEXT_FROM = 0.66;

export interface BlockColors {
  background: string;
  border: string;
  /** Passende Schriftfarbe für ausreichenden Kontrast */
  text: string;
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

/** Farben eines Controller-Blocks */
export function stationBlockColors(
  airport: string | null,
  group: StationGroup | null,
  eventAirports: string[]
): BlockColors {
  const hue = airportHue(airport, eventAirports);
  const lightness = group ? LEVEL_LIGHTNESS[group] : 0.6;

  // Ohne Airport-Bezug (FIR-weite Stationen) bleibt es bewusst neutral grau,
  // damit die farbigen Airports nicht an Aussagekraft verlieren.
  if (hue === null) {
    return {
      background: `oklch(${lightness} 0.02 260)`,
      border: `oklch(${lightness - 0.08} 0.02 260)`,
      text: lightness >= DARK_TEXT_FROM ? "oklch(0.25 0.02 260)" : "#fff",
    };
  }

  return {
    background: `oklch(${lightness} ${CHROMA} ${hue})`,
    border: `oklch(${Math.max(0.2, lightness - 0.1)} ${CHROMA} ${hue})`,
    text: lightness >= DARK_TEXT_FROM ? `oklch(0.28 ${CHROMA} ${hue})` : "#fff",
  };
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
