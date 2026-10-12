import { AIRPORT_ALIASES } from "@/config/airportAliases";

/**
 * Wunschstationen aus der Anmeldung deuten.
 *
 * Das Feld ist Freitext. Statt „EDDM_1_GND" steht dort oft „ne Runde APN",
 * „München Tower", „MUC TWR N/S", „1. APP 2. TWR" oder „gern Radar, kein DEL".
 * Daraus wird eine Liste konkreter Stationen des Events – mit Gewicht nach
 * Reihenfolge – und eine Liste ausdrücklich nicht gewünschter Stationen.
 *
 * Grundlage ist, was die Station selbst über sich verrät: Callsign
 * (EDDM_1_GND → EDDM, 1, GND), Datahub-Beschreibung („München Apron
 * (Apron 1)"), Kürzel und die weiteren Namen des Flughafens (MUC). Ein
 * Wunsch trifft alle Stationen, die zu seinen Begriffen passen. Wörter, die
 * keine Station kennt, werden überlesen – so stört Füllwerk nicht.
 *
 * Bewusst frei von React- und Server-Abhängigkeiten: Editor, Auto-Roster
 * und Tests deuten mit derselben Funktion.
 */

export interface WishStation {
  callsign: string;
  /** Datahub-Beschreibung, z. B. „München Apron (Apron 1)" */
  description?: string | null;
  /** Datahub-Kürzel, z. B. „DMG1" */
  abbreviation?: string | null;
}

export interface WishPart {
  /** Der Teil des Textes, aus dem gelesen wurde */
  text: string;
  callsigns: string[];
  negative: boolean;
}

export interface StationWishes {
  /** Callsign → Gewicht (1 = erster Wunsch, später genannte etwas weniger) */
  preferred: Map<string, number>;
  /** Ausdrücklich nicht gewünschte Stationen („kein DEL") */
  avoided: Set<string>;
  /** Was aus welchem Teil des Textes gelesen wurde – für die Anzeige */
  parts: WishPart[];
}

// ---------------------------------------------------------------------
// Wortschatz
// ---------------------------------------------------------------------

/** Begriffe für Dienste und Richtungen → einheitliches Token */
const SYNONYMS: Record<string, string> = {
  del: "DEL",
  delivery: "DEL",
  clearance: "DEL",
  cld: "DEL",
  gnd: "GND",
  ground: "GND",
  rollkontrolle: "GND",
  apn: "APRON",
  apron: "APRON",
  vorfeld: "APRON",
  vorfeldkontrolle: "APRON",
  twr: "TWR",
  tower: "TWR",
  turm: "TWR",
  app: "APP",
  approach: "APP",
  anflug: "APP",
  anflugkontrolle: "APP",
  dep: "DEP",
  departure: "DEP",
  abflug: "DEP",
  ctr: "CTR",
  center: "CTR",
  centre: "CTR",
  radar: "RADAR",
  arrival: "ARRIVAL",
  arr: "ARRIVAL",
  director: "DIRECTOR",
  dir: "DIRECTOR",
  deicing: "DEICING",
  enteisung: "DEICING",
  feeder: "FEEDER",
  vfr: "VFR",
  north: "N",
  nord: "N",
  norden: "N",
  south: "S",
  sud: "S",
  suden: "S",
  east: "E",
  ost: "E",
  osten: "E",
  west: "W",
  westen: "W",
  high: "H",
  hoch: "H",
  low: "L",
  tief: "L",
  central: "C",
};

/** Dienst-Tokens – sie gliedern einen Wunsch in Teilwünsche */
const FACILITIES = new Set([
  "DEL",
  "GND",
  "APRON",
  "TWR",
  "APP",
  "DEP",
  "CTR",
  "RADAR",
  "ARRIVAL",
  "DIRECTOR",
  "DEICING",
  "FEEDER",
  "VFR",
]);

/** Was das Callsign-Ende über die Station sagt */
const SUFFIX_TOKENS: Record<string, string[]> = {
  DEL: ["DEL"],
  GND: ["GND"],
  TWR: ["TWR"],
  APP: ["APP"],
  // Departure gehört zur Approach-Ebene – „Approach" trifft beides
  DEP: ["DEP", "APP"],
  CTR: ["CTR"],
};

const DIRECTION_LETTERS = new Set(["N", "S", "E", "W", "C", "H", "L", "D"]);

/** Füllwörter, die nie eine Station meinen (gefaltet geschrieben) */
const STOPWORDS = new Set([
  "a", "am", "an", "and", "any", "anything", "als", "at", "auch", "auf", "bedarf",
  "besetzen", "bevorzugt", "bevorzugen", "bin", "bitte", "da", "das", "dem", "den",
  "der", "des", "die", "egal", "ein", "eine", "einem", "einen", "einer", "einmal",
  "erst", "erste", "etc", "evtl", "first", "flexibel", "for", "fur", "gern", "gerne",
  "ggf", "hier", "i", "ich", "im", "in", "ist", "je", "lieber", "liebsten", "like",
  "mal", "maybe", "mit", "mochte", "moglich", "nach", "ne", "nen", "nochmal", "of",
  "oft", "on", "please", "position", "positionen", "prefer", "prio", "prioritat",
  "runde", "second", "sehr", "sind", "some", "station", "stationen", "the", "to",
  "vielleicht", "whatever", "wieder", "wunsch", "wunsche", "wurde", "would", "zu",
  "zum", "zur", "zweite", "alles", "gerne", "so",
]);

/** Ab hier gilt der Rest des Satzes als „nicht gewünscht" */
const NEGATIONS = new Set([
  "kein", "keine", "keinem", "keinen", "keiner", "nicht", "ohne", "ausser", "nie",
  "niemals", "no", "not", "never", "except", "without",
]);

/** Kleinschreibung, Umlaute vereinheitlicht (ü, ue → u) */
function fold(word: string): string {
  return word
    .toLowerCase()
    .replace(/ä|ae/g, "a")
    .replace(/ö|oe/g, "o")
    .replace(/ü|ue/g, "u")
    .replace(/ß/g, "ss");
}

/** Einheitliche Form eines Wortes – für Stationen und Wunschtext gleich */
function canon(word: string): string {
  const f = fold(word);
  const synonym = SYNONYMS[f];
  if (synonym) return synonym;
  return f.length <= 2 ? f.toUpperCase() : f;
}

const WORD = /[A-Za-zÄÖÜäöüß0-9]+/g;

/** Alles, woran man eine Station im Freitext erkennen kann */
export function stationTokens(station: WishStation): Set<string> {
  const tokens = new Set<string>();
  const parts = station.callsign.toUpperCase().split("_");
  const icao = parts[0];
  tokens.add(canon(icao));
  for (const alias of AIRPORT_ALIASES[icao] ?? []) tokens.add(canon(alias));

  for (const t of SUFFIX_TOKENS[parts[parts.length - 1]] ?? []) tokens.add(t);
  for (const part of parts.slice(1, -1)) {
    tokens.add(canon(part));
    // „ND" (North Director) heißt auch N und D
    if (part.length === 2 && [...part].every((ch) => DIRECTION_LETTERS.has(ch))) {
      for (const ch of part) tokens.add(ch);
    }
  }

  if (station.abbreviation) tokens.add(canon(station.abbreviation));

  if (station.description) {
    // In Klammern ist „Center" eine Richtung (Apron Center), kein Center-Sektor
    const inParens = new Set<number>();
    let depth = 0;
    for (let i = 0; i < station.description.length; i++) {
      const ch = station.description[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (depth > 0) inParens.add(i);
    }
    for (const m of station.description.matchAll(WORD)) {
      const f = fold(m[0]);
      if (inParens.has(m.index ?? -1) && (f === "center" || f === "central")) {
        tokens.add("C");
      } else {
        tokens.add(canon(m[0]));
      }
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------
// Deuten
// ---------------------------------------------------------------------

interface Phrase {
  strong: string[];
  weak: string[];
  words: string[];
  negative: boolean;
}

/** Trennt Sätze – eine Verneinung gilt bis zum Satzende */
const CLAUSE_SPLIT = /[,;.\n!?]+|\b(?:aber|but)\b/i;
/** Trennt Teilwünsche innerhalb eines Satzes */
const PIECE_SPLIT =
  /[/|+>&]|\s-\s|\b(?:oder|or|und|and|bzw|sonst|dann|danach|alternativ|alternatively|then|otherwise)\b/i;

const isStrong = (token: string) => FACILITIES.has(token) || token.length > 2;

export function parseStationWishes(text: string, stations: WishStation[]): StationWishes {
  const result: StationWishes = { preferred: new Map(), avoided: new Set(), parts: [] };
  if (!text || !text.trim() || stations.length === 0) return result;

  const tokensByStation = stations.map((s) => ({
    callsign: s.callsign.toUpperCase(),
    tokens: stationTokens(s),
  }));
  const vocabulary = new Set<string>();
  for (const s of tokensByStation) for (const t of s.tokens) vocabulary.add(t);

  let rank = 0;
  // Zuletzt genannter Dienst/Ort – „TWR, aber nicht S" meint den S-Tower
  let lastStrong: string[] = [];
  for (const clause of text.split(CLAUSE_SPLIT)) {
    if (!clause) continue;
    // Teilwünsche des Satzes einsammeln
    const phrases: Phrase[] = [];
    let negative = false;
    for (const piece of clause.split(PIECE_SPLIT)) {
      if (!piece) continue;
      const words = piece.match(WORD) ?? [];
      // Lesbare Wörter samt Token, Füllwerk und Unbekanntes fallen weg
      const tokens: { token: string; word: string }[] = [];
      for (const word of words) {
        const f = fold(word);
        if (NEGATIONS.has(f)) {
          negative = true;
          continue;
        }
        if (STOPWORDS.has(f)) continue;
        const token = canon(word);
        if (vocabulary.has(token) || FACILITIES.has(token)) tokens.push({ token, word });
      }
      if (tokens.length === 0) continue;

      // Mehrere Dienste in einem Stück („1. APP 2. TWR", „MUC TWR NUE APP")
      // sind mehrere Wünsche: Ein neuer Dienst beginnt einen neuen, und ein
      // Ortsname nach einem Dienst gehört schon zum nächsten.
      let current: Phrase = { strong: [], weak: [], words: [], negative };
      const hasFacility = (p: Phrase) => p.strong.some((t) => FACILITIES.has(t));
      tokens.forEach(({ token, word }, i) => {
        const facilityAhead = tokens.slice(i + 1).some((t) => FACILITIES.has(t.token));
        const startsNew =
          hasFacility(current) &&
          (FACILITIES.has(token) || (isStrong(token) && facilityAhead));
        if (startsNew) {
          phrases.push(current);
          current = { strong: [], weak: [], words: [], negative };
        }
        (isStrong(token) ? current.strong : current.weak).push(token);
        current.words.push(word);
      });
      phrases.push(current);
    }

    // Nur Richtungen/Nummern („TWR N/S", „Apron 1 oder 2"): Den Rest erben
    // sie vom Nachbarn im selben Satz, sonst vom zuletzt genannten.
    const ownStrong = phrases.map((p) => p.strong.length > 0);
    phrases.forEach((p, i) => {
      if (ownStrong[i]) return;
      const donor =
        phrases.slice(0, i).reverse().find((_, j) => ownStrong[i - 1 - j]) ??
        phrases.slice(i + 1).find((_, j) => ownStrong[i + 1 + j]);
      p.strong = donor ? [...donor.strong] : [...lastStrong];
    });
    const lastWithStrong = [...phrases].reverse().find((p) => p.strong.length > 0);
    if (lastWithStrong) lastStrong = lastWithStrong.strong;

    for (const p of phrases) {
      if (p.strong.length === 0) continue;
      let matches = tokensByStation.filter((s) => p.strong.every((t) => s.tokens.has(t)));
      if (p.weak.length > 0) {
        const narrowed = matches.filter((s) => p.weak.every((t) => s.tokens.has(t)));
        // Passt keine Station zu den Zusätzen, waren sie Füllwerk („ne")
        if (narrowed.length > 0) matches = narrowed;
      }
      if (matches.length === 0) continue;
      const callsigns = matches.map((m) => m.callsign);
      result.parts.push({ text: p.words.join(" "), callsigns, negative: p.negative });
      if (p.negative) {
        for (const cs of callsigns) result.avoided.add(cs);
      } else {
        const weight = Math.max(0.4, 1 - 0.2 * rank);
        for (const cs of callsigns) {
          result.preferred.set(cs, Math.max(result.preferred.get(cs) ?? 0, weight));
        }
        rank++;
      }
    }
  }

  // Ausdrücklich nicht gewünscht schlägt einen allgemeinen Wunsch
  for (const cs of result.avoided) result.preferred.delete(cs);
  return result;
}
