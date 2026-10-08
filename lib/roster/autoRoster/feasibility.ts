import { buildModel, DEFAULT_PLANNER_OPTIONS, levelName, type PlanningModel } from "./model";
import { priorityMatching } from "./matching";
import type {
  CapacityShortfall,
  FeasibilityGap,
  FeasibilityReport,
  PlannerOptions,
  PlanningInput,
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

export function analyzeModel(model: PlanningModel): FeasibilityReport {
  const { stations, controllers, slotCount, starts, ends, open, available, eligible } = model;
  const S = stations.length;
  const C = controllers.length;

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
    rows.forEach((s, i) => {
      demandMinutes += len;
      if (match[i] >= 0) {
        coverableMinutes += len;
      } else {
        gapReason[s][t] = adj[i].length === 0 ? "no_candidate" : "contention";
        gapCandidates[s][t] = adj[i].length;
      }
    });
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
  const { maxShift, minBreak } = model.options;
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

    let supply = 0;
    for (let c = 0; c < C; c++) {
      // Zeitfenster, in denen die Person eine offene Station dieser Ebenen
      // besetzen könnte
      let window = 0;
      for (let t = 0; t < slotCount; t++) {
        let usable = false;
        if (available[c][t]) {
          for (let s = 0; s < S && !usable; s++) {
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
  };
}
