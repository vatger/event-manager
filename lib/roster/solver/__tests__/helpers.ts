/**
 * Hilfen für die Tests der automatischen Planung: Eingaben bauen und das
 * Ergebnis unabhängig vom Rechenkern gegen die harten Grenzen prüfen.
 */

import type { CoreSession } from "../core";
import type { SolverControllerInput, SolverInput, SolverStationInput } from "../types";

export function station(
  callsign: string,
  slotCount: number,
  opts: Partial<Omit<SolverStationInput, "callsign">> = {}
): SolverStationInput {
  return {
    id: opts.id ?? Math.abs(hash(callsign)),
    callsign,
    priority: opts.priority ?? 3,
    level: opts.level ?? 2,
    airport: opts.airport ?? null,
    open: opts.open ?? Array.from({ length: slotCount }, () => true),
  };
}

export function controller(
  cid: number,
  slotCount: number,
  opts: Partial<Omit<SolverControllerInput, "cid">> = {}
): SolverControllerInput {
  return {
    cid,
    available: opts.available ?? Array.from({ length: slotCount }, () => true),
    eligible: opts.eligible ?? [],
    wishRank: opts.wishRank ?? {},
    hasWishes: opts.hasWishes ?? Object.keys(opts.wishRank ?? {}).length > 0,
    partners: opts.partners ?? [],
    maxTotalSlots: opts.maxTotalSlots ?? null,
    level: opts.level ?? 2,
    fixed: opts.fixed ?? [],
  };
}

/** Eingabe im 30-Minuten-Raster mit den Standardwerten des Plans (60/120/90, 30 Pause) */
export function input(
  slotCount: number,
  stations: SolverStationInput[],
  controllers: SolverControllerInput[],
  opts: Partial<SolverInput> = {}
): SolverInput {
  return {
    slotMinutes: 30,
    slotCount,
    stations,
    controllers,
    minSessionSlots: 2,
    maxSessionSlots: 4,
    preferredSessionSlots: 3,
    minBreakSlots: 1,
    maxBreakSlots: null,
    maxTotalSlots: null,
    preferenceWeight: 5,
    fairnessWeight: 5,
    timeLimitMs: 300,
    seed: 1,
    ...opts,
  };
}

/** Slot-Array: true außer in den angegebenen Bereichen [from, to) */
export function slotsExcept(slotCount: number, ...ranges: [number, number][]): boolean[] {
  return Array.from({ length: slotCount }, (_, t) => !ranges.some(([a, b]) => t >= a && t < b));
}

/** Alle Verstöße gegen harte Grenzen – leer heißt gültig */
export function hardViolations(inp: SolverInput, sessions: CoreSession[]): string[] {
  const errs: string[] = [];
  const stationSlot = new Set<string>();

  for (const s of sessions) {
    const tag = `${inp.stations[s.station]?.callsign}/${inp.controllers[s.ctrl]?.cid}@${s.start}-${s.end}`;
    const st = inp.stations[s.station];
    const c = inp.controllers[s.ctrl];
    if (!st || !c) {
      errs.push(`${tag}: unbekannte Station/Person`);
      continue;
    }
    const len = s.end - s.start;
    if (len < inp.minSessionSlots) errs.push(`${tag}: kürzer als Minimum`);
    if (len > inp.maxSessionSlots) errs.push(`${tag}: länger als Maximum`);
    if (s.start < 0 || s.end > inp.slotCount) errs.push(`${tag}: außerhalb des Events`);
    if (!c.eligible.includes(s.station)) errs.push(`${tag}: nicht geeignet`);
    for (let t = s.start; t < s.end; t++) {
      if (!st.open[t]) errs.push(`${tag}: Slot ${t} nicht zu besetzen`);
      if (!c.available[t]) errs.push(`${tag}: Slot ${t} nicht verfügbar`);
      const key = `${s.station}:${t}`;
      if (stationSlot.has(key)) errs.push(`${tag}: Station in Slot ${t} doppelt belegt`);
      stationSlot.add(key);
    }
  }

  inp.controllers.forEach((c, ci) => {
    const blocks = [
      ...sessions
        .filter((s) => s.ctrl === ci)
        .map((s) => ({ ...s, counts: true, counted: s.end - s.start, fixed: false })),
      ...c.fixed.map((f) => ({
        station: f.station ?? -1,
        start: f.start,
        end: f.end,
        counts: f.counts,
        counted: f.countedSlots ?? f.end - f.start,
        fixed: true,
      })),
    ].sort((a, b) => a.start - b.start);

    for (let i = 1; i < blocks.length; i++) {
      const a = blocks[i - 1];
      const b = blocks[i];
      if (a.fixed && b.fixed) continue;
      const gap = b.start - a.end;
      if (gap < 0) errs.push(`${c.cid}: Überschneidung bei ${b.start}`);
      else if (gap < inp.minBreakSlots) errs.push(`${c.cid}: Pause ${gap} vor ${b.start} zu kurz`);
      else if (gap === 0 && a.station === b.station) errs.push(`${c.cid}: Schichten ohne Pause verschmolzen`);
    }

    // Persönliche Grenze ersetzt die des Plans
    const limit = c.maxTotalSlots ?? inp.maxTotalSlots;
    if (typeof limit === "number" && limit >= 0) {
      const total = blocks.filter((b) => b.counts).reduce((n, b) => n + b.counted, 0);
      if (total > limit + 1e-9) errs.push(`${c.cid}: Gesamtzeit ${total} über ${limit}`);
    }
  });

  return errs;
}

/** Besetzte Slots je Station */
export function coverage(inp: SolverInput, sessions: CoreSession[]): number[] {
  const out = inp.stations.map(() => 0);
  for (const s of sessions) out[s.station] += s.end - s.start;
  return out;
}

/** Zufällige, aber reproduzierbare Eingabe für Eigenschaftstests */
export function randomInput(seed: number, opts: { slotMinutes: number; hours: number; stations: number; controllers: number }): SolverInput {
  const r = lcg(seed);
  const g = opts.slotMinutes;
  const T = (opts.hours * 60) / g;
  const stations = Array.from({ length: opts.stations }, (_, k) =>
    station(`S${k}_TWR`, T, { id: k + 1, priority: 1 + Math.floor(r() * 5), level: k % 5 })
  );
  // Custom-Block mitten im Event auf der ersten Station
  for (let t = Math.floor(T / 3); t < Math.floor(T / 2); t++) stations[0].open[t] = false;

  const controllers = Array.from({ length: opts.controllers }, (_, c) => {
    const level = Math.floor(r() * 5);
    const eligible = stations.flatMap((s, k) => (s.level <= level && r() > 0.1 ? [k] : []));
    const available = Array.from({ length: T }, () => true);
    if (r() < 0.4) {
      const a = Math.floor(r() * T);
      const b = Math.min(T, a + Math.floor((r() * T) / 2));
      for (let t = a; t < b; t++) available[t] = false;
    }
    const wishRank: Record<number, number> = {};
    if (r() < 0.7) {
      eligible
        .slice()
        .sort(() => r() - 0.5)
        .slice(0, 3)
        .forEach((k, i) => (wishRank[k] = i));
    }
    const fixed: SolverControllerInput["fixed"] = [];
    if (r() < 0.15) {
      const start = Math.floor(r() * (T - 4));
      fixed.push({ start, end: start + 2, station: null, counts: r() < 0.5 });
    }
    return controller(1000 + c, T, {
      level,
      eligible,
      available,
      wishRank,
      maxTotalSlots: r() < 0.2 ? Math.round(120 / g) : null,
      fixed,
    });
  });

  return {
    slotMinutes: g,
    slotCount: T,
    stations,
    controllers,
    minSessionSlots: 60 / g,
    maxSessionSlots: 120 / g,
    preferredSessionSlots: 90 / g,
    minBreakSlots: 30 / g,
    maxBreakSlots: 120 / g,
    maxTotalSlots: 240 / g,
    preferenceWeight: 5,
    fairnessWeight: 5,
    timeLimitMs: 400,
    seed,
  };
}

function lcg(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 2 ** 32;
  };
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
