import {
  buildModel,
  DEFAULT_PLANNER_OPTIONS,
  LEVEL_RANK,
  levelName,
  type PlanningModel,
} from "./model";
import { priorityMatching } from "./matching";
import type {
  CapacityShortfall,
  FeasibilityGap,
  FeasibilityGroup,
  FeasibilityReport,
  PlannerOptions,
  PlanningInput,
  TimeRangeMinutes,
} from "./types";

/** Unter diesem Verhältnis von Lotsenzeit zu Bedarf gilt der Plan als knapp */
const TIGHT_RATIO = 1.2;

/**
 * Höchste Lotsenzeit in einem zusammenhängenden Fenster, wenn nach
 * `maxShift` Minuten am Stück jeweils `minBreak` Pause fällig ist.
 */
export function maxWorkInWindow(length: number, maxShift: number, minBreak: number): number {
  if (length <= 0) return 0;
  const cycle = maxShift + minBreak;
  const full = Math.floor(length / cycle);
  const rest = length - full * cycle;
  return full * maxShift + Math.min(rest, maxShift);
}

/**
 * Geht der Plan mit den Anmeldungen auf?
 *
 * Zwei Prüfungen, beide Obergrenzen – was sie als Lücke melden, kann kein
 * Plan füllen:
 *
 * 1. Je Slot werden die offenen Stationen von oben nach unten mit den
 *    verfügbaren, geeigneten Personen gepaart. Was dabei leer bleibt, ist
 *    in diesem Moment nicht besetzbar.
 * 2. Über das ganze Event wird für die Ebenen von oben (CTR, CTR+APP, …) der
 *    Bedarf an Stationsminuten der Lotsenzeit gegenübergestellt, die die
 *    dafür geeigneten Personen unter Einhaltung der Pausenregel höchstens
 *    leisten können. Das deckt Engpässe auf, die erst durch Pausen
 *    entstehen.
 */
export function analyzeFeasibility(
  input: PlanningInput,
  options: Partial<PlannerOptions> = {}
): FeasibilityReport {
  const model = buildModel(input, { ...DEFAULT_PLANNER_OPTIONS, ...options });
  return analyzeModel(model);
}

/**
 * Lotsenzeit, die die Personen auf einer Stationsmenge höchstens leisten
 * können: je Person die Zeitfenster, in denen sie eine offene Station der
 * Menge besetzen könnte, mit Pausenregel.
 */
function pauseAwareSupply(model: PlanningModel, inSet: boolean[]): number {
  const { stations, controllers, slotCount, starts, ends, open, available, eligible } = model;
  const { maxShift, minBreak } = model.options;
  let supply = 0;
  for (let c = 0; c < controllers.length; c++) {
    let window = 0;
    for (let t = 0; t < slotCount; t++) {
      let usable = false;
      if (available[c][t]) {
        for (let s = 0; s < stations.length && !usable; s++) {
          usable = inSet[s] && open[s][t] === 1 && eligible[c][s] === 1;
        }
      }
      if (usable) {
        window += ends[t] - starts[t];
      } else if (window > 0) {
        supply += maxWorkInWindow(window, maxShift, minBreak);
        window = 0;
      }
    }
    supply += maxWorkInWindow(window, maxShift, minBreak);
  }
  return supply;
}

/**
 * Besetzungsgruppen: Stationen derselben Ebene, bei mehreren Airports je
 * Airport. Center gehören zu keinem Airport und bilden immer eine Gruppe.
 */
function buildGroups(model: PlanningModel) {
  const multiAirport = model.eventAirports.length > 1;
  const defs: {
    key: string;
    label: string;
    level: string;
    rank: number;
    airport: string | null;
    stations: number[];
  }[] = [];
  const groupOf = new Int32Array(model.stations.length);
  model.stations.forEach((st, s) => {
    const rank = model.levels[s];
    const level = levelName(rank);
    const airport =
      multiAirport && rank !== LEVEL_RANK.CTR ? st.meta.airport?.toUpperCase() ?? null : null;
    const key = `${airport ?? ""}|${level}`;
    let g = defs.findIndex((d) => d.key === key);
    if (g < 0) {
      g = defs.length;
      defs.push({ key, label: airport ? `${airport} ${level}` : level, level, rank, airport, stations: [] });
    }
    defs[g].stations.push(s);
    groupOf[s] = g;
  });
  return { defs, groupOf };
}

/** Benachbarte Slot-Zeiträume zusammenfassen */
function pushRange(list: TimeRangeMinutes[], start: number, end: number) {
  const last = list[list.length - 1];
  if (last && last.end === start) last.end = end;
  else list.push({ start, end });
}

export function analyzeModel(model: PlanningModel): FeasibilityReport {
  const { stations, controllers, slotCount, starts, ends, open, available, eligible } = model;
  const S = stations.length;
  const C = controllers.length;

  const { defs: groupDefs, groupOf } = buildGroups(model);
  const G = groupDefs.length;
  const groupGap = new Float64Array(G);
  const groupMinReserve = new Array<number>(G).fill(Infinity);
  const groupNoReserve: TimeRangeMinutes[][] = groupDefs.map(() => []);

  // --- 1) Momentaufnahmen je Slot -------------------------------------
  let demandMinutes = 0;
  let coverableMinutes = 0;
  // Je Station und Slot: null = besetzbar oder nicht offen
  const gapReason: (("no_candidate" | "contention") | null)[][] = stations.map(() =>
    new Array(slotCount).fill(null)
  );
  const gapCandidates: number[][] = stations.map(() => new Array(slotCount).fill(0));

  for (let t = 0; t < slotCount; t++) {
    const len = ends[t] - starts[t];
    const rows: number[] = [];
    for (let s = 0; s < S; s++) if (open[s][t]) rows.push(s);
    if (rows.length === 0) continue;
    const adj = rows.map((s) => {
      const cols: number[] = [];
      for (let c = 0; c < C; c++) if (eligible[c][s] && available[c][t]) cols.push(c);
      return cols;
    });
    const match = priorityMatching(adj, C);
    const used = new Uint8Array(C);
    const gapInGroup = new Uint8Array(G);
    rows.forEach((s, i) => {
      demandMinutes += len;
      if (match[i] >= 0) {
        coverableMinutes += len;
        used[match[i]] = 1;
      } else {
        gapReason[s][t] = adj[i].length === 0 ? "no_candidate" : "contention";
        gapCandidates[s][t] = adj[i].length;
        groupGap[groupOf[s]] += len;
        gapInGroup[groupOf[s]] = 1;
      }
    });

    // Reserve je Gruppe: Wer könnte jetzt noch einspringen, ohne dass ihm
    // anderswo jemand fehlt?
    for (let g = 0; g < G; g++) {
      const openHere = groupDefs[g].stations.filter((s) => open[s][t]);
      if (openHere.length === 0) continue;
      let reserve = 0;
      for (let c = 0; c < C; c++) {
        if (used[c] || !available[c][t]) continue;
        if (openHere.some((s) => eligible[c][s])) reserve++;
      }
      if (reserve < groupMinReserve[g]) groupMinReserve[g] = reserve;
      if (reserve === 0 && !gapInGroup[g]) pushRange(groupNoReserve[g], starts[t], ends[t]);
    }
  }

  const gaps: FeasibilityGap[] = [];
  for (let s = 0; s < S; s++) {
    let t = 0;
    while (t < slotCount) {
      const reason = gapReason[s][t];
      if (!reason) {
        t++;
        continue;
      }
      let u = t;
      let candidates = gapCandidates[s][t];
      while (u + 1 < slotCount && gapReason[s][u + 1] === reason) {
        u++;
        candidates = Math.min(candidates, gapCandidates[s][u]);
      }
      gaps.push({
        stationId: stations[s].id,
        callsign: stations[s].callsign,
        start: starts[t],
        end: ends[u],
        reason,
        candidates,
      });
      t = u + 1;
    }
  }

  // --- 2) Lotsenzeit gegen Bedarf, Ebenen von oben kumuliert ----------
  const levelsPresent = [...new Set(model.levels)].sort((a, b) => b - a);
  const shortfalls: CapacityShortfall[] = [];
  let capacityRatio: number | null = null;

  for (let k = 0; k < levelsPresent.length; k++) {
    const inSet = model.levels.map((l) => l >= levelsPresent[k]);
    let demand = 0;
    for (let s = 0; s < S; s++) {
      if (!inSet[s]) continue;
      for (let t = 0; t < slotCount; t++) if (open[s][t]) demand += ends[t] - starts[t];
    }
    if (demand === 0) continue;

    // Zeitfenster, in denen die Personen eine offene Station dieser Ebenen
    // besetzen könnten
    const supply = pauseAwareSupply(model, inSet);

    const ratio = supply / demand;
    capacityRatio = capacityRatio === null ? ratio : Math.min(capacityRatio, ratio);
    if (supply < demand) {
      shortfalls.push({
        levels: levelsPresent.slice(0, k + 1).map(levelName),
        demandMinutes: demand,
        supplyMinutes: supply,
        missingMinutes: demand - supply,
      });
    }
  }

  // --- Übersicht je Station und Person --------------------------------
  const candidatesByStation: Record<number, number> = {};
  for (let s = 0; s < S; s++) {
    let count = 0;
    for (let c = 0; c < C; c++) {
      if (!eligible[c][s]) continue;
      for (let t = 0; t < slotCount; t++) {
        if (available[c][t] && open[s][t]) {
          count++;
          break;
        }
      }
    }
    candidatesByStation[stations[s].id] = count;
  }
  const unusableCids = controllers
    .filter((_, c) => !eligible[c].some((e) => e === 1))
    .map((c) => c.cid);

  // --- Besetzungsgruppen ---------------------------------------------
  const groups: FeasibilityGroup[] = groupDefs
    .map((d, g) => {
      const inSet = stations.map((_, s) => groupOf[s] === g);
      let demand = 0;
      for (const s of d.stations) {
        for (let t = 0; t < slotCount; t++) if (open[s][t]) demand += ends[t] - starts[t];
      }
      const supply = demand > 0 ? pauseAwareSupply(model, inSet) : 0;
      const ratio = demand > 0 ? supply / demand : null;
      const minReserve = Number.isFinite(groupMinReserve[g]) ? groupMinReserve[g] : 0;
      const status: FeasibilityGroup["status"] =
        groupGap[g] > 0 || (ratio !== null && ratio < 1)
          ? "short"
          : (ratio !== null && ratio < TIGHT_RATIO) || groupNoReserve[g].length > 0
          ? "tight"
          : "ok";
      return {
        key: d.key,
        label: d.label,
        level: d.level,
        airport: d.airport,
        callsigns: d.stations.map((s) => stations[s].callsign),
        demandMinutes: demand,
        supplyMinutes: supply,
        ratio,
        gapMinutes: groupGap[g],
        minReserve,
        noReserveRanges: groupNoReserve[g],
        status,
        rank: d.rank,
      };
    })
    .filter((g) => g.demandMinutes > 0)
    .sort((a, b) => b.rank - a.rank || (a.airport ?? "").localeCompare(b.airport ?? ""))
    .map((g) => {
      const { rank, ...rest } = g;
      void rank;
      return rest;
    });

  const verdict =
    gaps.length > 0 || shortfalls.length > 0
      ? "insufficient"
      : capacityRatio !== null && capacityRatio < TIGHT_RATIO
      ? "tight"
      : "ok";

  return {
    verdict,
    demandMinutes,
    coverableMinutes,
    gaps,
    shortfalls,
    capacityRatio,
    candidatesByStation,
    unusableCids,
    groups,
  };
}
