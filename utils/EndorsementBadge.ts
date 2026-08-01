/**
 * Farbklassen für Endorsement- und Rating-Badges.
 *
 * Die Werte kommen aus der kategorialen Stations-Palette in app/globals.css
 * (--station-*). Sie ist bewusst getrennt von den semantischen Marken-Rollen
 * success/warning/danger, die das Brandbook ausschließlich ihrer Bedeutung
 * vorbehält. Farben also nie hier hartkodieren, sondern in globals.css ändern.
 */

/** Stationsgruppe → weiche Badge-Fläche + zugehörige Textfarbe */
const GROUP_BADGE: Record<string, string> = {
  DEL: "bg-station-del-soft text-station-del-text",
  GND: "bg-station-gnd-soft text-station-gnd-text",
  TWR: "bg-station-twr-soft text-station-twr-text",
  APP: "bg-station-app-soft text-station-app-text",
  CTR: "bg-station-ctr-soft text-station-ctr-text",
};

/** VATSIM-Rating → Stationsgruppe, deren Farbe das Rating erbt */
const RATING_GROUP: Record<string, keyof typeof GROUP_BADGE> = {
  S1: "GND",
  S2: "TWR",
  S3: "APP",
  C1: "CTR",
  C2: "CTR",
  C3: "CTR",
  I1: "CTR",
  I2: "CTR",
  I3: "CTR",
};

const NEUTRAL = "bg-station-none-soft text-station-none-text";

export function getBadgeClassForEndorsement(endorsement?: string | null) {
  if (!endorsement) return NEUTRAL;
  const key = endorsement.toUpperCase();
  const direct = GROUP_BADGE[key];
  if (direct) return direct;
  const viaRating = RATING_GROUP[key];
  return viaRating ? GROUP_BADGE[viaRating] : NEUTRAL;
}

/**
 * Vollton-Klassen für gefüllte Flächen (z. B. Blöcke in der Roster-Timeline),
 * die weiße Schrift tragen.
 */
const GROUP_SOLID: Record<string, string> = {
  DEL: "bg-station-del border-station-del",
  GND: "bg-station-gnd border-station-gnd",
  TWR: "bg-station-twr border-station-twr",
  APP: "bg-station-app border-station-app",
  CTR: "bg-station-ctr border-station-ctr",
};

export function getSolidClassForStationGroup(group?: string | null) {
  if (!group) return "bg-station-none border-station-none";
  return GROUP_SOLID[group.toUpperCase()] ?? "bg-station-none border-station-none";
}
