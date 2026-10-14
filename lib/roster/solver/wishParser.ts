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
}

export interface ParsedWishes {
  preferredStations: string[];
  avoidedStations: string[];
}

const GROUP_WORDS: { group: StationGroup; re: RegExp }[] = [
  { group: "DEL", re: /\b(del|delivery|clearance)\b/i },
  { group: "GND", re: /\b(gnd|ground|apron|vorfeld|rollkontrolle)\b/i },
  { group: "TWR", re: /\b(twr|tower|turm)\b/i },
  { group: "APP", re: /\b(app|approach|anflug|dep|departure|director)\b/i },
  // „DIR“ nur großgeschrieben – kleingeschrieben ist es meist das deutsche „dir“
  { group: "APP", re: /\bDIR\b/ },
  { group: "CTR", re: /\b(ctr|center|centre|radar|enroute|en-route)\b/i },
];

const NEGATION = /\b(kein|keine|keinen|nicht|no|not|without|ohne|außer|ausser|except|bitte nicht)\b/i;
/** Redewendungen mit Verneinungswort, die nichts ablehnen („kein Problem mit GND“) */
const NEGATION_IDIOM = /\b(kein|keine|no)\s+(problem|probleme|problems|thema|issue|issues|stress)\b/gi;
function isNegated(text: string): boolean {
  return NEGATION.test(text.replace(NEGATION_IDIOM, ""));
}
const ANYTHING = /^\s*(egal|alles|any|anything|whatever|flexibel|flexible|-)\s*[.!]?\s*$/i;

function normalize(text: string): string {
  return text.toUpperCase().replace(/[\s-]+/g, "_");
}

// Ein Satzende („No DEL please. Tower“) trennt ebenfalls – nur mit folgendem
// Leerraum, damit „EDDF.TWR“ oder „19.30“ zusammenbleiben
const SEPARATOR = /([,;/\n|>]+|\.\s+|\s+(?:oder|or|und|and|dann|then|sonst|else)\s+|&)/i;
const CONJUNCTION = /^\s*(oder|or|und|and|&)\s*$/i;
/** Trenner, über die ein „außer …“ hinwegreicht – „dann“, „>“, „;“ beenden es */
const LIST_SEPARATOR = /^\s*(,+|\/|oder|or|und|and|&)\s*$/i;
const EXCEPT = /\b(außer|ausser|except|ohne|without)\b/i;
/**
 * Innerhalb eines Abschnitts beginnt vor einer vorangestellten Verneinung ein
 * neuer Teil: „Tower ohne Ground“, „TWR (not DEL)“. Nachgestellte („DEL bitte
 * nicht“) bleiben beim Vorangehenden.
 */
const NEGATION_START =
  /\s*(?=\()|\s+(?=(?:ohne|außer|ausser|except|without|but|aber|kein|keine|keinen|no|not)(?![\p{L}\p{N}]))/iu;
const EVERYTHING = /^(alles|all|everything|anything|egal)$/i;

/**
 * Eine nachgestellte Verneinung ohne Station gilt nur dann dem Davorstehenden,
 * wenn sie aus nichts als Verneinung und Füllwörtern besteht („no“, „not
 * please“, „keine Lust“). „kein Problem“, „nicht vor 19z“ oder „aber nicht zu
 * lange“ sagen etwas anderes und bleiben unberücksichtigt.
 */
const BARE_NEGATION_WORDS = new Set(["kein", "keine", "keinen", "nicht", "no", "not"]);
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
      const inherited = j === 0 && (carryExcept || (prevNegated && afterConjunction));
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

/**
 * Welche Stationen des Plans meint ein Abschnitt? In der Reihenfolge, in der
 * sie im Text stehen (sie ist die Rangfolge), bei Gleichstand wie im Plan.
 */
function matchSegment(segment: string, stations: WishStation[]): { cs: string; pos: number }[] {
  const found = new Map<string, number>();
  const add = (cs: string, pos: number) => {
    if (!found.has(cs)) found.set(cs, pos);
  };
  const ordered = () =>
    [...found.entries()].sort((a, b) => a[1] - b[1]).map(([cs, pos]) => ({ cs, pos }));
  const norm = normalize(segment);

  // 1. Vollständige Callsigns (EDDF_TWR, EDDF_N_TWR, EDDF TWR, EDDF-N-TWR)
  for (const st of stations) {
    const cs = escapeRegExp(st.callsign.toUpperCase()).replace(/_/g, "_?");
    const m = new RegExp(`(^|[^A-Z0-9])${cs}($|[^A-Z0-9])`).exec(norm);
    if (m) add(st.callsign, m.index);
  }
  if (found.size > 0) return ordered();

  // 2. Datahub-Kürzel (DMC, DMG …)
  const words: string[] = segment.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  for (const st of stations) {
    const abbr = st.abbreviation?.toUpperCase();
    const pos = abbr && abbr.length >= 2 ? words.indexOf(abbr) : -1;
    if (pos >= 0) add(st.callsign, pos);
  }
  if (found.size > 0) return ordered();

  // 3. Ebene, ggf. auf genannte Airports eingegrenzt („EDDF Tower")
  const airports = new Set(
    words.filter((w) => /^[A-Z]{4}$/.test(w) && stations.some((s) => s.airport === w))
  );
  const groups = new Map<StationGroup, number>();
  for (const g of GROUP_WORDS) {
    const m = g.re.exec(segment);
    if (m) groups.set(g.group, Math.min(m.index, groups.get(g.group) ?? Infinity));
  }
  if (groups.size > 0) {
    for (const st of stations) {
      const pos = st.group ? groups.get(st.group) : undefined;
      if (pos === undefined) continue;
      if (airports.size > 0 && st.airport && !airports.has(st.airport)) continue;
      add(st.callsign, pos);
    }
    return ordered();
  }

  // 4. Nur ein Airport genannt: alle seine Stationen
  for (const st of stations) {
    if (st.airport && airports.has(st.airport)) add(st.callsign, 0);
  }
  return ordered();
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
