/**
 * Vorschlag für strukturierte Wünsche aus dem Freitext einer Anmeldung.
 *
 * Controller schreiben ihre Wunschstationen frei: „EDDF TWR oder APP",
 * „Tower, kein DEL", „DMC > DMG", „alles außer Delivery". Daraus entsteht hier
 * ein Vorschlag – Reihenfolge des Auftretens als Rangfolge, verneinte Angaben
 * als „will nicht". Das Eventteam prüft und korrigiert ihn, bevor er gilt;
 * gespeichert wird nichts automatisch.
 */

import type { StationGroup } from "@/lib/weeklys/stationUtils";

export interface WishStation {
  callsign: string;
  group: StationGroup | null;
  airport: string | null;
  /** Kürzel aus dem Datahub, z. B. "DMC" */
  abbreviation?: string | null;
  /** Bezeichnung aus dem Datahub, z. B. "München Apron (Apron 1)" */
  description?: string | null;
}

export interface ParsedWishes {
  preferredStations: string[];
  avoidedStations: string[];
}

/**
 * Art einer Station, wie Controller sie nennen – nicht die Endorsement-Gruppe:
 * In München zählt EDDM_N_GND für die Freigabe zum Tower, „TWR“ im Wunsch
 * meint trotzdem nur die Tower. Vorfeld (Apron) und Rollkontrolle (Ground)
 * teilen sich das Kürzel _GND und unterscheiden sich nur in der Bezeichnung.
 */
type StationKind = "DEL" | "CODEL" | "GND" | "APN" | "DEICE" | "TWR" | "APP" | "CTR";

const KIND_WORDS: { kind: StationKind; re: RegExp }[] = [
  // Vor DEL, damit „CO_DEL“ nicht auch als Delivery zählt
  { kind: "CODEL", re: /\bco[\s_-]?(?:del|delivery)\b|\bcoordinator\b/gi },
  { kind: "DEL", re: /\b(del|delivery|clearance)\b/gi },
  { kind: "GND", re: /\b(gnd|ground|rollkontrolle|rollfeld)\b/gi },
  { kind: "TWR", re: /\b(twr|tower|turm)\b/gi },
  { kind: "APP", re: /\b(app|approach|anflug|dep|departure)\b/gi },
  { kind: "CTR", re: /\b(ctr|center|centre|radar|enroute|en-route)\b/gi },
];

/** Vorfeld, optional mit Nummer: „APN2“, „apn 1“, „Apron 3“ */
const APRON = /\b(?:apn|apron|vorfeld)(?:[\s_-]?(\d))?\b/gi;

/**
 * Teile eines Approach-Bereichs, die nur die Datahub-Bezeichnung kennt
 * („München Radar (North High)“). Findet sich keine passende Station, gelten
 * Director und Feeder als Approach allgemein, High und Low als nichts.
 */
const APP_PARTS: { re: RegExp; desc: RegExp; fallbackToApp: boolean }[] = [
  { re: /\bhigh\b/gi, desc: /\bhigh\b/i, fallbackToApp: false },
  { re: /\blow\b/gi, desc: /\blow\b/i, fallbackToApp: false },
  // „DIR“ nur großgeschrieben – kleingeschrieben ist es meist das deutsche „dir“
  { re: /\bdirector\b|\bDIR\b/g, desc: /\bdirector\b/i, fallbackToApp: true },
  { re: /\bfeeder\b/gi, desc: /\b(feeder|arrival)\b/i, fallbackToApp: true },
];

function kindOf(st: WishStation): StationKind | null {
  const m = /_(DEL|GND|TWR|APP|DEP|CTR)$/.exec(st.callsign.toUpperCase());
  if (!m) return null;
  const desc = st.description ?? "";
  switch (m[1]) {
    case "DEL":
      return /_CO_DEL$/i.test(st.callsign) || /coordinator/i.test(desc) ? "CODEL" : "DEL";
    case "GND":
      if (/de-?icing/i.test(desc) || /_ICE_GND$/i.test(st.callsign)) return "DEICE";
      return /apron|vorfeld/i.test(desc) ? "APN" : "GND";
    case "DEP":
      return "APP";
    default:
      return m[1] as StationKind;
  }
}

/** Mittelteile des Callsigns: EDDM_NL_APP → ["NL"], EDDF_CO_DEL → ["CO"] */
function designators(st: WishStation): string[] {
  const parts = st.callsign.toUpperCase().split("_");
  return parts.slice(/^[A-Z]{4}$/.test(parts[0]) ? 1 : 0, -1);
}

const NEGATION =
  /\b(kein|keine|keinen|nicht|nix|nichts|ungern|ungerne|no|not|without|ohne|außer|ausser|except|bitte nicht)\b/i;
/**
 * Redewendungen mit Verneinungswort, die nichts ablehnen: „kein Problem mit
 * GND“, „wenn Not am Mann auch EDMA“.
 */
const NEGATION_IDIOM =
  /\b(kein|keine|no)\s+(problem|probleme|problems|thema|issue|issues|stress)\b|\bnot\s+am\s+mann?\b/gi;
function isNegated(text: string): boolean {
  return NEGATION.test(text.replace(NEGATION_IDIOM, ""));
}
/** Ausdrücklich Gewünschtes übernimmt keine Verneinung vom Vorgänger („kein DEL / gerne TWR“) */
const POSITIVE = /\b(gerne|gern|lieber|bevorzugt|bevorzuge|prefer|preferred|please)\b/i;
const ANYTHING = /^\s*(egal|alles|any|anything|whatever|flexibel|flexible|-)\s*[.!]?\s*$/i;

// Ein Satzende („No DEL please. Tower“) trennt ebenfalls – nur mit folgendem
// Leerraum, damit „EDDF.TWR“ oder „19.30“ zusammenbleiben
const SEPARATOR = /([,;/\n|>]+|\.\s+|\s+(?:oder|or|und|and|dann|then|sonst|else)\s+|&)/i;
const CONJUNCTION = /^\s*(oder|or|und|and|&|\/)\s*$/i;
/** Trenner, über die ein „außer …“ hinwegreicht – „dann“, „>“, „;“ beenden es */
const LIST_SEPARATOR = /^\s*(,+|\/|oder|or|und|and|&)\s*$/i;
const EXCEPT = /\b(außer|ausser|except|ohne|without)\b/i;
/**
 * Innerhalb eines Abschnitts beginnt vor einer vorangestellten Verneinung ein
 * neuer Teil: „Tower ohne Ground“, „TWR (not DEL)“. Nachgestellte („DEL bitte
 * nicht“) bleiben beim Vorangehenden.
 */
const NEGATION_START =
  /\s*(?=\()|\s+(?=(?:ohne|außer|ausser|except|without|but|aber|kein|keine|keinen|nix|nichts|ungern|ungerne|no|not)(?![\p{L}\p{N}]))/iu;
const EVERYTHING = /^(alles|all|everything|anything|egal)$/i;

/**
 * Eine nachgestellte Verneinung ohne Station gilt nur dann dem Davorstehenden,
 * wenn sie aus nichts als Verneinung und Füllwörtern besteht („no“, „not
 * please“, „keine Lust“). „kein Problem“, „nicht vor 19z“ oder „aber nicht zu
 * lange“ sagen etwas anderes und bleiben unberücksichtigt.
 */
const BARE_NEGATION_WORDS = new Set([
  "kein", "keine", "keinen", "nicht", "nix", "nichts", "ungern", "ungerne", "no", "not",
]);
const BARE_NEGATION_FILLER = new Set([
  "bitte", "please", "pls", "plz", "danke", "thanks", "thx", "lust", "bock", "mehr",
  "gerne", "gern", "so", "really", "wirklich", "gar", "überhaupt", "ueberhaupt",
  "aber", "but", "lieber", "eher", "rather", "way", "möglichst", "moeglichst",
]);
function isBareNegation(text: string): boolean {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (/\p{N}/u.test(text)) return false;
  return (
    words.some((w) => BARE_NEGATION_WORDS.has(w)) &&
    words.every((w) => BARE_NEGATION_WORDS.has(w) || BARE_NEGATION_FILLER.has(w))
  );
}

/**
 * Freitext in Abschnitte zerlegen. Eine Verneinung gilt bis zum nächsten
 * Trenner: „Tower, kein DEL, APP" → TWR gewünscht, DEL nicht, APP gewünscht.
 * Über „und"/„oder" reicht sie hinweg („kein DEL und GND" → beide nicht),
 * ein vorangestelltes „außer"/„ohne" auch über Kommas („alles außer DEL, GND"),
 * aber nicht über „dann“, „>“ oder „;“. „Tower ohne DEL, APP“ verneint nur DEL.
 * `continues`: Teil desselben Abschnitts wie der vorige (vor einer Verneinung
 * abgetrennt).
 */
function segments(text: string): { text: string; negated: boolean; continues: boolean }[] {
  // split mit Gruppe: Text und Trenner wechseln sich ab
  const pieces = text.split(SEPARATOR);
  const out: { text: string; negated: boolean; continues: boolean }[] = [];
  let prevNegated = false;
  let carryExcept = false;
  for (let i = 0; i < pieces.length; i += 2) {
    const sep = i > 0 ? pieces[i - 1] : "";
    if (!LIST_SEPARATOR.test(sep)) carryExcept = false;
    const afterConjunction = CONJUNCTION.test(sep);
    const parts = pieces[i]
      .split(NEGATION_START)
      .map((p) => p.trim())
      .filter(Boolean);
    parts.forEach((p, j) => {
      const inherited =
        j === 0 && (carryExcept || (prevNegated && afterConjunction && !POSITIVE.test(p)));
      const negated: boolean = isNegated(p) || inherited;
      if (negated && EXCEPT.test(p)) {
        // Weiter reicht es nur für „alles außer …“ bzw. ein alleinstehendes
        // „außer …“ – nicht, wenn davor eine Station steht
        const before = parts.slice(0, j).join(" ").replace(/[()]/g, "").trim();
        carryExcept = before === "" || EVERYTHING.test(before);
      }
      prevNegated = negated;
      out.push({ text: p, negated, continues: j > 0 });
    });
  }
  return out;
}

/** Für einen RegExp maskieren – Callsigns sind Freitext */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Gefundene Stelle durch Leerzeichen ersetzen – Positionen bleiben gleich */
function blank(text: string, index: number, length: number): string {
  return text.slice(0, index) + " ".repeat(length) + text.slice(index + length);
}

/**
 * Welche Stationen des Plans meint ein Abschnitt? In der Reihenfolge, in der
 * sie im Text stehen (sie ist die Rangfolge), bei Gleichstand wie im Plan.
 *
 * Erkannt werden ganze Callsigns, Datahub-Kürzel, Callsign-Mittelteile
 * („NL“ → EDDM_NL_APP), Vorfeld mit Nummer („APN2“), Approach-Teile aus der
 * Bezeichnung („High“, „Feeder“) und Stationsarten („Tower“). Genaues wird vor
 * Allgemeinem gesucht und danach ausgeblendet: „EDDF_N_TWR“ meint nicht alle
 * Tower.
 */
function matchSegment(segment: string, stations: WishStation[]): { cs: string; pos: number }[] {
  const found = new Map<string, number>();
  const add = (cs: string, pos: number) => {
    if (!found.has(cs) || found.get(cs)! > pos) found.set(cs, pos);
  };
  let text = segment;
  /** Treffer, die noch auf genannte Airports eingegrenzt werden */
  const general: { st: WishStation; pos: number }[] = [];

  // 1. Vollständige Callsigns (EDDF_TWR, EDDF_N_TWR, EDDF TWR, EDDF-N-TWR)
  for (const st of stations) {
    const parts = st.callsign.toUpperCase().split("_").map(escapeRegExp);
    const re = new RegExp(`(?<![A-Z0-9])${parts.join("[\\s_-]*")}(?![A-Z0-9])`, "gi");
    for (const m of segment.matchAll(re)) {
      add(st.callsign, m.index);
      text = blank(text, m.index, m[0].length);
    }
  }

  // 2. Datahub-Kürzel (DMC, DMG1 …)
  for (const st of stations) {
    const abbr = st.abbreviation?.toUpperCase();
    if (!abbr || abbr.length < 2) continue;
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(abbr)}(?![A-Za-z0-9])`, "gi");
    for (const m of text.matchAll(re)) {
      add(st.callsign, m.index);
      text = blank(text, m.index, m[0].length);
    }
  }

  // 3. Callsign-Mittelteile, nur großgeschrieben („NL“, „SD“ – nicht „an“, „as“)
  const byDesignator = new Map<string, WishStation[]>();
  for (const st of stations) {
    for (const d of designators(st)) {
      if (d.length < 2 || !/^[A-Z0-9]+$/.test(d)) continue;
      byDesignator.set(d, [...(byDesignator.get(d) ?? []), st]);
    }
  }
  for (const m of text.matchAll(/(?<![A-Za-z0-9])[A-Z0-9]{2,4}(?![A-Za-z0-9])/g)) {
    const hits = byDesignator.get(m[0]);
    if (!hits) continue;
    for (const st of hits) general.push({ st, pos: m.index });
    text = blank(text, m.index, m[0].length);
  }

  // 4. Vorfeld, ggf. mit Nummer
  for (const m of text.matchAll(APRON)) {
    const nr = m[1];
    for (const st of stations) {
      if (kindOf(st) !== "APN") continue;
      if (nr && !designators(st).includes(nr) && !new RegExp(`apron\\s*${nr}\\b`, "i").test(st.description ?? "")) {
        continue;
      }
      general.push({ st, pos: m.index });
    }
    text = blank(text, m.index, m[0].length);
  }

  // 5. Approach-Teile aus der Datahub-Bezeichnung
  for (const part of APP_PARTS) {
    for (const m of text.matchAll(part.re)) {
      let hits = stations.filter((st) => kindOf(st) === "APP" && part.desc.test(st.description ?? ""));
      if (hits.length === 0 && part.fallbackToApp) hits = stations.filter((st) => kindOf(st) === "APP");
      for (const st of hits) general.push({ st, pos: m.index });
      text = blank(text, m.index, m[0].length);
    }
  }

  // 6. Stationsarten. „Ground“ ohne Rollkontrolle im Plan meint das Vorfeld.
  const hasGround = stations.some((st) => kindOf(st) === "GND");
  for (const { kind, re } of KIND_WORDS) {
    for (const m of text.matchAll(re)) {
      for (const st of stations) {
        const k = kindOf(st);
        if (k === kind || (kind === "GND" && !hasGround && k === "APN")) general.push({ st, pos: m.index });
      }
      text = blank(text, m.index, m[0].length);
    }
  }

  // Genannte Airports („EDDF Tower“) grenzen das Allgemeine ein
  const words: string[] = text.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const airports = new Set(
    words.filter((w) => /^[A-Z]{4}$/.test(w) && stations.some((s) => s.airport === w))
  );
  for (const { st, pos } of general) {
    if (airports.size > 0 && st.airport && !airports.has(st.airport)) continue;
    add(st.callsign, pos);
  }

  // 7. Nur ein Airport genannt: alle seine Stationen
  if (found.size === 0) {
    for (const st of stations) {
      if (st.airport && airports.has(st.airport)) add(st.callsign, 0);
    }
  }

  const planOrder = new Map(stations.map((st, i) => [st.callsign, i]));
  return [...found.entries()]
    .sort((a, b) => a[1] - b[1] || planOrder.get(a[0])! - planOrder.get(b[0])!)
    .map(([cs, pos]) => ({ cs, pos }));
}

export function parseWishes(text: string | null | undefined, stations: WishStation[]): ParsedWishes {
  const preferred: string[] = [];
  const avoided: string[] = [];
  if (!text || ANYTHING.test(text)) return { preferredStations: [], avoidedStations: [] };

  let prev: { negated: boolean; matches: { cs: string; pos: number }[] } | null = null;
  for (const seg of segments(text)) {
    const found = matchSegment(seg.text, stations);
    const matches = found.map((m) => m.cs);
    // Nachgestellte Verneinung ohne eigene Station („DEL no“, „GND: keine
    // Lust“) gilt dem Teil davor – „GND kein Problem“ dagegen nicht. Gemeint
    // ist dort nur das zuletzt Genannte: „Tower - Delivery no“ lehnt DEL ab,
    // nicht auch den Tower.
    if (
      seg.negated &&
      seg.continues &&
      matches.length === 0 &&
      prev &&
      !prev.negated &&
      prev.matches.length > 0 &&
      isBareNegation(seg.text)
    ) {
      const lastPos = Math.max(...prev.matches.map((m) => m.pos));
      for (const m of prev.matches) {
        if (m.pos === lastPos && !avoided.includes(m.cs)) avoided.push(m.cs);
      }
    }
    prev = { negated: seg.negated, matches: found };
    for (const cs of matches) {
      if (seg.negated) {
        if (!avoided.includes(cs)) avoided.push(cs);
      } else if (!preferred.includes(cs)) {
        preferred.push(cs);
      }
    }
  }
  return {
    preferredStations: preferred.filter((c) => !avoided.includes(c)),
    avoidedStations: avoided,
  };
}

export interface WishPerson {
  cid: number;
  name: string;
}

/** Bis zu so vielen Wörtern vor einem Namen hebt eine Verneinung ihn auf („nicht mit Max“) */
const PARTNER_NEGATION_WINDOW = 3;

/**
 * Wen will die Person neben sich haben? Erkennt die Namen anderer
 * Angemeldeter im Freitext („gerne mit Justin Korte“, „was angrenzendes mit
 * Giuseppe“): den vollen Namen, oder Vor- bzw. Nachnamen allein, wenn er
 * unter den Angemeldeten eindeutig ist. Kürzel wie „MF“ werden nicht geraten.
 * In der Reihenfolge des Textes; verneinte Nennungen („nicht mit …“) fallen weg.
 */
export function parsePartners(
  text: string | null | undefined,
  people: WishPerson[],
  selfCid: number
): number[] {
  if (!text) return [];
  const words = [...text.matchAll(/[\p{L}][\p{L}'-]*/gu)].map((m) => ({
    word: m[0].toLowerCase(),
    index: m.index,
  }));
  const others = people.filter((p) => p.cid !== selfCid);
  const parts = (p: WishPerson) => p.name.toLowerCase().split(/\s+/).filter(Boolean);
  const count = (pick: (n: string[]) => string | undefined) => {
    const c = new Map<string, number>();
    for (const p of people) {
      const w = pick(parts(p));
      if (w) c.set(w, (c.get(w) ?? 0) + 1);
    }
    return c;
  };
  const firstCount = count((n) => n[0]);
  const lastCount = count((n) => (n.length > 1 ? n[n.length - 1] : undefined));

  const hits: { cid: number; at: number }[] = [];
  for (const p of others) {
    const n = parts(p);
    let at = -1;
    for (let i = 0; i < words.length && at < 0; i++) {
      const full = n.every((part, k) => words[i + k]?.word === part);
      const first = n[0].length >= 3 && words[i].word === n[0] && firstCount.get(n[0]) === 1;
      const last =
        n.length > 1 &&
        n[n.length - 1].length >= 3 &&
        words[i].word === n[n.length - 1] &&
        lastCount.get(n[n.length - 1]) === 1;
      if (!full && !first && !last) continue;
      const before = words
        .slice(Math.max(0, i - PARTNER_NEGATION_WINDOW), i)
        .map((w) => w.word)
        .join(" ");
      if (isNegated(before)) continue;
      at = words[i].index;
    }
    if (at >= 0) hits.push({ cid: p.cid, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.cid);
}
