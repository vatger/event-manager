import { isUnavailable } from "@/lib/roster/rosterEligibility";
import {
  buildModel,
  DEFAULT_PLANNER_OPTIONS,
  subtractRanges,
  type PlanningModel,
} from "./model";
import { minCostAssignment, priorityMatching } from "./matching";
import { breaksShiftRules, type ShiftLike } from "./rules";
import type {
  AutoRosterResult,
  PlannedAssignment,
  PlannerOptions,
  PlanningInput,
  TimeRangeMinutes,
  UncoveredRange,
} from "./types";

/**
 * Automatische Besetzung eines Rosters.
 *
 * Ablauf je Durchlauf:
 *
 * 1. **Zeit-Sweep über die Slots.** Laufende Schichten gehen weiter, bis ihre
 *    Ziellänge erreicht ist (höchstens `maxShift` am Stück). Für die übrigen
 *    offenen Stationen wird zuerst bestimmt, *welche* besetzt werden – von
 *    oben nach unten (CTR vor APP vor TWR …), als größtmögliche Paarung –
 *    und dann, *wer* wohin geht: Wunschstation, Solo-Position, faire
 *    Verteilung und das Schonen knapper Freigaben entscheiden.
 * 2. **Reparatur.** Verbleibende Lücken werden durch Verlängern oder durch
 *    freie Personen geschlossen, sofern Pausen- und Wechselregeln es zulassen.
 * 3. **Prüfung.** Jeder Block wird gegen dieselben Regeln geprüft, nach denen
 *    der Editor warnt; was nicht passt, fällt heraus.
 *
 * Mehrere Durchläufe mit unterschiedlicher Schichtlänge und leichtem,
 * reproduzierbarem Zufall konkurrieren; gewählt wird nach Abdeckung von oben
 * nach unten, dann nach möglichst wenigen kurzen Restschichten, möglichst
 * vielen eingesetzten Personen, erfüllten Wünschen, wenigen Übergaben und
 * gleichmäßiger Verteilung.
 */

/** Gewichte für die Wahl der Person, sobald feststeht, welche Station besetzt wird */
const WEIGHT = {
  /** Abgelaufene Schicht verlängern statt übergeben */
  extension: -2,
  /** … es sei denn, sonst entstünde nur noch ein kurzer Rest */
  tailExtension: 6,
  preference: 3,
  solo: 4,
  /** Je knapper die höheren Stationen, die die Person sonst besetzen könnte */
  scarcity: 4,
  /** Je Stunde, die die Person schon eingeplant ist */
  perHourAssigned: -1,
  /** Noch gar nicht eingeplant */
  firstShift: 2,
  /** Dieselbe Station wie vor der Pause */
  sameStation: 1,
};

const BIG = 1e9;

/** Reproduzierbarer Zufall (mulberry32) */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Geplanter Block, Station und Person als Index im Modell */
interface Block {
  s: number;
  c: number;
  start: number;
  end: number;
}

/**
 * Kosten, eine Person auf Station `s` einzusetzen, obwohl sie auch höhere
 * Stationen besetzen dürfte, für die es nur wenige gibt. So landet die
 * einzige Person mit CTR-Freigabe nicht auf Ground.
 */
function scarcityCosts(model: PlanningModel): Float64Array[] {
  const { stations, controllers, eligible, free, levels } = model;
  const scarcity = stations.map((_, s) => {
    let n = 0;
    controllers.forEach((_, c) => {
      if (eligible[c][s] && free[c].some((x) => x === 1)) n++;
    });
    return 1 / Math.max(1, n);
  });
  return controllers.map((_, c) =>
    Float64Array.from(stations, (_, s) => {
      let sum = 0;
      for (let o = 0; o < s; o++) {
        if (eligible[c][o] && levels[o] > levels[s]) sum += scarcity[o];
      }
      return sum * WEIGHT.scarcity;
    })
  );
}

/** Restlänge (Minuten) zusammenhängender gesetzter Slots ab jedem Slot */
function runLengths(model: PlanningModel, mask: Uint8Array): Float64Array {
  const run = new Float64Array(model.slotCount + 1);
  for (let t = model.slotCount - 1; t >= 0; t--) {
    run[t] = mask[t] ? model.ends[t] - model.starts[t] + run[t + 1] : 0;
  }
  return run;
}

// =====================================================================
// 1) Zeit-Sweep
// =====================================================================

function sweep(
  model: PlanningModel,
  scarcity: Float64Array[],
  rng: () => number,
  targetShift: number,
  jitter: number
): Block[] {
  const { stations, controllers, slotCount, starts, ends, open, free, eligible, total, slot } =
    model;
  const { minShift, maxShift, minBreak } = model.options;
  const S = stations.length;
  const C = controllers.length;

  const openRun = open.map((row) => runLengths(model, row));
  const freeRun = free.map((row) => runLengths(model, row));

  const runOf: (Block | null)[] = new Array(S).fill(null);
  const targetEnd = new Float64Array(S);
  const holding = new Int32Array(C).fill(-1);
  const lastEnd = new Float64Array(C).fill(-Infinity);
  const lastStation = new Int32Array(C).fill(-1);
  // Feste Schichten zählen mit – wer schon von Hand eingeplant ist, hat
  // nicht „noch keine Schicht".
  const assigned = Float64Array.from(model.fixedMinutes);
  const blocks: Block[] = [];

  const pickLength = (s: number, t: number) => {
    let len = targetShift;
    if (jitter > 0 && rng() < 0.3) len += (rng() < 0.5 ? -1 : 1) * slot;
    len = Math.min(maxShift, Math.max(minShift, Math.round(len / slot) * slot));
    // Bliebe danach nur ein Rest unter `minShift`, gleich mit übernehmen
    const rest = openRun[s][t] - len;
    if (rest > 0 && rest < minShift && len + rest <= maxShift) len += rest;
    return len;
  };

  const quality = (s: number, c: number, extension: boolean, shortTail: boolean) => {
    let q = 0;
    if (extension) q += shortTail ? WEIGHT.tailExtension : WEIGHT.extension;
    if (model.prefers[c][s]) q += WEIGHT.preference;
    if (model.solo[c][s]) q += WEIGHT.solo;
    q -= scarcity[c][s];
    q += (assigned[c] / 60) * WEIGHT.perHourAssigned;
    if (assigned[c] === 0) q += WEIGHT.firstShift;
    if (lastStation[c] === s) q += WEIGHT.sameStation;
    if (jitter > 0) q += rng() * jitter;
    return q;
  };

  for (let t = 0; t < slotCount; t++) {
    const a = starts[t];
    const b = ends[t];
    const locked = new Uint8Array(C);
    const toFill: number[] = [];
    const released: (Block | null)[] = new Array(S).fill(null);

    // Laufende Schichten fortsetzen oder beenden
    for (let s = 0; s < S; s++) {
      const run = runOf[s];
      if (!run) {
        if (open[s][t]) toFill.push(s);
        continue;
      }
      const h = run.c;
      const canContinue = open[s][t] === 1 && free[h][t] === 1 && b - run.start <= maxShift;
      if (canContinue && a < targetEnd[s]) {
        run.end = b;
        locked[h] = 1;
        assigned[h] += b - a;
        continue;
      }
      runOf[s] = null;
      holding[h] = -1;
      lastEnd[h] = a;
      lastStation[h] = s;
      if (open[s][t]) {
        toFill.push(s);
        // Wer am Ziel angekommen ist, darf nur hier weitermachen – ein
        // Wechsel ginge nicht ohne Pause.
        if (canContinue) released[s] = run;
      }
    }
    if (toFill.length === 0) continue;

    // Kandidaten je offener Station
    const cols: number[] = [];
    const colOf = new Map<number, number>();
    const col = (c: number) => {
      let j = colOf.get(c);
      if (j === undefined) {
        j = cols.length;
        cols.push(c);
        colOf.set(c, j);
      }
      return j;
    };
    const adj: number[][] = [];
    const extensionCol: number[] = [];
    for (const s of toFill) {
      const list: number[] = [];
      const ext = released[s];
      if (ext) {
        const j = col(ext.c);
        list.push(j);
        extensionCol.push(j);
      } else {
        extensionCol.push(-1);
      }
      // Eine neue Schicht muss mindestens `minShift` tragen – kürzer nur, wo
      // die Station selbst bzw. das Event nicht mehr Zeit lässt.
      const need = Math.min(minShift, openRun[s][t], total - a);
      for (let c = 0; c < C; c++) {
        if (locked[c] || holding[c] >= 0 || !eligible[c][s] || !free[c][t]) continue;
        if (a - lastEnd[c] < minBreak) continue;
        if (freeRun[c][t] < need) continue;
        list.push(col(c));
      }
      adj.push(list);
    }

    // Welche Stationen werden besetzt? Von oben nach unten.
    const match = priorityMatching(adj, cols.length);
    const rows = toFill.map((_, i) => i).filter((i) => match[i] >= 0);
    if (rows.length === 0) continue;

    // Wer geht wohin?
    const cost = rows.map((i) => {
      const s = toFill[i];
      const shortTail = Math.min(openRun[s][t], total - a) < minShift;
      const row = new Array<number>(cols.length).fill(BIG);
      for (const j of adj[i]) row[j] = -quality(s, cols[j], extensionCol[i] === j, shortTail);
      return row;
    });
    let chosen = minCostAssignment(cost, cols.length);
    if (rows.some((_, k) => chosen[k] < 0 || cost[k][chosen[k]] >= BIG)) {
      chosen = Int32Array.from(rows, (i) => match[i]);
    }

    rows.forEach((i, k) => {
      const s = toFill[i];
      const c = cols[chosen[k]];
      const ext = released[s];
      if (ext && ext.c === c) {
        // Ein weiterer Slot, danach wird neu entschieden
        ext.end = b;
        runOf[s] = ext;
        targetEnd[s] = b;
      } else {
        const run: Block = { s, c, start: a, end: b };
        blocks.push(run);
        runOf[s] = run;
        targetEnd[s] = a + pickLength(s, t);
      }
      holding[c] = s;
      assigned[c] += b - a;
    });
  }

  return blocks;
}

// =====================================================================
// 2) Reparatur und Prüfung
// =====================================================================

const overlaps = (a: number, b: number, x: number, y: number) => a < y && x < b;

/** Geplante Blöcke samt Prüfung gegen feste Blöcke und Regeln */
class PlanState {
  blocks: Block[];
  private fixedOnStation: TimeRangeMinutes[][];
  private fixedBusy: TimeRangeMinutes[][];
  private fixedShifts: ShiftLike[][];

  constructor(private model: PlanningModel, blocks: Block[]) {
    this.blocks = blocks;
    this.fixedOnStation = model.stations.map((st) =>
      model.fixed.filter((f) => f.stationId === st.id)
    );
    this.fixedBusy = model.controllers.map((ctrl) =>
      model.fixed.filter((f) => f.userCID === ctrl.cid)
    );
    this.fixedShifts = model.controllers.map((ctrl) =>
      model.fixed.filter((f) => f.userCID === ctrl.cid && f.stationId !== null)
    );
  }

  /** Darf Person `c` von `x` bis `y` auf Station `s`? */
  canPlace(c: number, s: number, x: number, y: number, ignore?: Block): boolean {
    const m = this.model;
    if (y <= x || !m.eligible[c][s]) return false;
    if (isUnavailable(m.controllers[c], x, y)) return false;
    if (this.fixedOnStation[s].some((f) => overlaps(f.start, f.end, x, y))) return false;
    if (this.fixedBusy[c].some((f) => overlaps(f.start, f.end, x, y))) return false;
    const shifts: ShiftLike[] = [...this.fixedShifts[c]];
    for (const bl of this.blocks) {
      if (bl === ignore) continue;
      if (bl.s === s && overlaps(bl.start, bl.end, x, y)) return false;
      if (bl.c !== c) continue;
      if (overlaps(bl.start, bl.end, x, y)) return false;
      shifts.push({ stationId: m.stations[bl.s].id, start: bl.start, end: bl.end });
    }
    const { maxShift, minBreak } = m.options;
    return !breaksShiftRules(shifts, { stationId: m.stations[s].id, start: x, end: y }, maxShift, minBreak);
  }

  /** Hat die Person direkt angrenzend schon eine Schicht auf dieser Station? */
  touchesOwnShift(c: number, s: number, x: number, y: number): boolean {
    const touches = (start: number, end: number) => end === x || start === y;
    const id = this.model.stations[s].id;
    return (
      this.fixedShifts[c].some((f) => f.stationId === id && touches(f.start, f.end)) ||
      this.blocks.some((bl) => bl.c === c && bl.s === s && touches(bl.start, bl.end))
    );
  }

  uncovered(s: number): TimeRangeMinutes[] {
    const planned = this.blocks.filter((bl) => bl.s === s);
    return this.model.openRanges[s].flatMap((r) => subtractRanges(r, planned));
  }

  minutesOf(c: number): number {
    let sum = this.model.fixedMinutes[c];
    for (const bl of this.blocks) if (bl.c === c) sum += bl.end - bl.start;
    return sum;
  }
}

function repair(model: PlanningModel, state: PlanState, scarcity: Float64Array[]): void {
  const { minShift } = model.options;
  const slot = model.slot;
  const nextGrid = (y: number) => (Math.floor(y / slot) + 1) * slot;

  for (let s = 0; s < model.stations.length; s++) {
    for (const gap of state.uncovered(s)) {
      // Kürzer als `minShift` nur, wenn die Lücke selbst so kurz ist oder
      // eine eigene Schicht auf dieser Station verlängert wird.
      const need = Math.min(minShift, gap.end - gap.start);
      let x = gap.start;
      while (x < gap.end) {
        let best: { c: number; end: number; score: number } | null = null;
        for (let c = 0; c < model.controllers.length; c++) {
          if (!model.eligible[c][s]) continue;
          let y = x;
          while (y < gap.end) {
            const ny = Math.min(gap.end, nextGrid(y));
            if (!state.canPlace(c, s, x, ny)) break;
            y = ny;
          }
          if (y === x) continue;
          if (y - x < need && !state.touchesOwnShift(c, s, x, y)) continue;
          const assigned = state.minutesOf(c);
          const quality =
            (model.prefers[c][s] ? WEIGHT.preference : 0) +
            (model.solo[c][s] ? WEIGHT.solo : 0) -
            scarcity[c][s] +
            (assigned / 60) * WEIGHT.perHourAssigned +
            (assigned === 0 ? WEIGHT.firstShift : 0);
          // Mehr Abdeckung schlägt jede Vorliebe
          const score = (y - x) * 100 + quality;
          if (!best || score > best.score) best = { c, end: y, score };
        }
        if (best) {
          state.blocks.push({ s, c: best.c, start: x, end: best.end });
          x = best.end;
        } else {
          x = Math.min(gap.end, nextGrid(x));
        }
      }
    }
  }
}

/** Angrenzende Blöcke derselben Person auf derselben Station zusammenführen */
function mergeAdjacent(blocks: Block[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.s - b.s || a.start - b.start);
  const merged: Block[] = [];
  for (const bl of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.s === bl.s && last.c === bl.c && last.end === bl.start) {
      last.end = bl.end;
    } else {
      merged.push({ ...bl });
    }
  }
  return merged;
}

/** Was die Regeln verletzt, fällt heraus – zur Sicherheit, sollte nie greifen */
function validate(state: PlanState): void {
  for (const bl of [...state.blocks]) {
    if (!state.canPlace(bl.c, bl.s, bl.start, bl.end, bl)) {
      state.blocks = state.blocks.filter((x) => x !== bl);
    }
  }
}

// =====================================================================
// 3) Bewertung
// =====================================================================

const LEVEL_ORDER = [5, 4, 3, 2, 1, 0];

interface Score {
  coverageByLevel: number[];
  /** Schichten unter `minShift` – ein stimmiger Plan kommt ohne aus */
  shortBlocks: number;
  idle: number;
  preferenceMinutes: number;
  blocks: number;
  spread: number;
}

/** Personen, die überhaupt etwas besetzen könnten */
function usableControllers(model: PlanningModel): number[] {
  const result: number[] = [];
  model.controllers.forEach((_, c) => {
    const usable = model.stations.some(
      (_, s) =>
        model.eligible[c][s] === 1 &&
        model.free[c].some((f, t) => f === 1 && model.open[s][t] === 1)
    );
    if (usable) result.push(c);
  });
  return result;
}

function scorePlan(model: PlanningModel, blocks: Block[], usable: number[]): Score {
  const coverage = new Map<number, number>();
  const minutes = Float64Array.from(model.fixedMinutes);
  let preferenceMinutes = 0;
  let shortBlocks = 0;
  for (const bl of blocks) {
    const len = bl.end - bl.start;
    if (len < model.options.minShift) shortBlocks++;
    const level = model.levels[bl.s];
    coverage.set(level, (coverage.get(level) ?? 0) + len);
    minutes[bl.c] += len;
    if (model.prefers[bl.c][bl.s]) preferenceMinutes += len;
  }
  const idle = usable.filter((c) => minutes[c] === 0).length;
  const mean = usable.reduce((sum, c) => sum + minutes[c], 0) / Math.max(1, usable.length);
  const spread =
    usable.reduce((sum, c) => sum + (minutes[c] - mean) ** 2, 0) / Math.max(1, usable.length);
  return {
    coverageByLevel: LEVEL_ORDER.map((l) => coverage.get(l) ?? 0),
    shortBlocks,
    idle,
    preferenceMinutes,
    blocks: blocks.length,
    spread,
  };
}

/** > 0, wenn `a` besser ist */
function compareScores(a: Score, b: Score): number {
  for (let i = 0; i < a.coverageByLevel.length; i++) {
    const d = a.coverageByLevel[i] - b.coverageByLevel[i];
    if (d !== 0) return d;
  }
  if (a.shortBlocks !== b.shortBlocks) return b.shortBlocks - a.shortBlocks;
  if (a.idle !== b.idle) return b.idle - a.idle;
  if (a.preferenceMinutes !== b.preferenceMinutes) return a.preferenceMinutes - b.preferenceMinutes;
  if (a.blocks !== b.blocks) return b.blocks - a.blocks;
  return b.spread - a.spread;
}

// =====================================================================
// Einstieg
// =====================================================================

export function planRoster(
  input: PlanningInput,
  options: Partial<PlannerOptions> = {}
): AutoRosterResult {
  const merged = { ...DEFAULT_PLANNER_OPTIONS, ...options };
  const maxShift = Math.max(input.slotMinutes, merged.maxShift);
  const opts: PlannerOptions = {
    ...merged,
    maxShift,
    minShift: Math.min(maxShift, Math.max(input.slotMinutes, merged.minShift)),
    minBreak: Math.max(0, merged.minBreak),
  };
  const model = buildModel(input, opts);
  const scarcity = scarcityCosts(model);
  const usable = usableControllers(model);

  // Zielschichtlängen von lang nach kurz, jeweils im Raster
  const lengths: number[] = [];
  for (let len = opts.maxShift; len >= opts.minShift; len -= model.slot) lengths.push(len);
  if (lengths.length === 0) lengths.push(opts.maxShift);

  let best: { blocks: Block[]; score: Score } | null = null;
  const iterations = Math.max(1, Math.floor(opts.iterations));
  for (let i = 0; i < iterations; i++) {
    const rng = createRng(opts.seed * 7919 + i);
    // Die ersten Durchläufe ohne Zufall, je einer pro Ziellänge
    const jitter = i < lengths.length ? 0 : 1.5;
    const blocks = sweep(model, scarcity, rng, lengths[i % lengths.length], jitter);
    const state = new PlanState(model, blocks);
    repair(model, state, scarcity);
    state.blocks = mergeAdjacent(state.blocks);
    validate(state);
    const score = scorePlan(model, state.blocks, usable);
    if (!best || compareScores(score, best.score) > 0) best = { blocks: state.blocks, score };
  }

  return buildResult(model, best?.blocks ?? [], usable);
}

function buildResult(model: PlanningModel, blocks: Block[], usable: number[]): AutoRosterResult {
  const assignments: PlannedAssignment[] = [...blocks]
    .sort((a, b) => a.s - b.s || a.start - b.start)
    .map((bl) => ({
      stationId: model.stations[bl.s].id,
      userCID: model.controllers[bl.c].cid,
      start: bl.start,
      end: bl.end,
    }));

  const uncovered: UncoveredRange[] = [];
  let openMinutes = 0;
  model.stations.forEach((st, s) => {
    const planned = blocks.filter((bl) => bl.s === s);
    for (const r of model.openRanges[s]) {
      openMinutes += r.end - r.start;
      for (const rest of subtractRanges(r, planned)) uncovered.push({ stationId: st.id, ...rest });
    }
  });

  const minutesByCid: Record<number, number> = {};
  let coveredMinutes = 0;
  for (const a of assignments) {
    minutesByCid[a.userCID] = (minutesByCid[a.userCID] ?? 0) + (a.end - a.start);
    coveredMinutes += a.end - a.start;
  }

  const unassignedCids = usable
    .filter((c) => !minutesByCid[model.controllers[c].cid] && model.fixedMinutes[c] === 0)
    .map((c) => model.controllers[c].cid);

  return { assignments, uncovered, openMinutes, coveredMinutes, minutesByCid, unassignedCids };
}
