import {
  checkEligibility,
  endorsementDataForStation,
  isUnavailable,
  type RosterController,
} from "@/lib/roster/rosterEligibility";
import { MAX_CONTINUOUS_MINUTES, MIN_BREAK_MINUTES } from "@/lib/roster/rosterTime";
import type {
  FixedBlock,
  PlannerOptions,
  PlanningInput,
  PlanningStation,
  TimeRangeMinutes,
} from "./types";

export const DEFAULT_PLANNER_OPTIONS: PlannerOptions = {
  minShift: 60,
  maxShift: MAX_CONTINUOUS_MINUTES,
  minBreak: MIN_BREAK_MINUTES,
  respectPreferences: true,
  excludedStationIds: [],
  seed: 1,
  iterations: 24,
};

/**
 * Rang einer Ebene für die Priorität „von oben nach unten": Wer CTR besetzt,
 * deckt die Stationen darunter mit ab – fehlt dort jemand, ist das weniger
 * schlimm als ein leeres Center.
 */
export const LEVEL_RANK: Record<string, number> = { CTR: 5, APP: 4, TWR: 3, GND: 2, DEL: 1 };

export function stationLevel(station: PlanningStation): number {
  return station.meta.group ? LEVEL_RANK[station.meta.group] ?? 0 : 0;
}

export function levelName(level: number): string {
  return Object.keys(LEVEL_RANK).find((k) => LEVEL_RANK[k] === level) ?? "Sonstige";
}

/** Stationen in Planungsreihenfolge: Ebene absteigend, dann Reihenfolge im Editor */
export function sortByPriority(stations: PlanningStation[]): PlanningStation[] {
  return [...stations].sort(
    (a, b) =>
      stationLevel(b) - stationLevel(a) ||
      a.sortOrder - b.sortOrder ||
      a.callsign.localeCompare(b.callsign)
  );
}

/**
 * Vorberechnete Sicht auf ein Event im Slot-Raster.
 *
 * Stationen stehen in Prioritätsreihenfolge (Index 0 = zuerst zu besetzen),
 * Controller sind nur die, die automatisch eingeplant werden dürfen.
 */
export interface PlanningModel {
  options: PlannerOptions;
  eventAirports: string[];
  total: number;
  slot: number;
  slotCount: number;
  starts: number[];
  ends: number[];
  stations: PlanningStation[];
  levels: number[];
  controllers: RosterController[];
  fixed: FixedBlock[];
  /** [c][s] – darf die Person die Station besetzen? */
  eligible: Uint8Array[];
  /** [c][t] – verfügbar und durch keinen festen Block gebunden */
  available: Uint8Array[];
  /** [c][t] – wie `available`, zusätzlich mit Pausenabstand zu festen Schichten */
  free: Uint8Array[];
  /** [s][t] – Station im Slot zu besetzen (kein fester Block darauf) */
  open: Uint8Array[];
  /** [s] – offene Zeiträume der Station auf Minutenbasis */
  openRanges: TimeRangeMinutes[][];
  /** [c][s] – Wunschstation laut Anmeldung */
  prefers: Uint8Array[];
  /** [c][s] – Solo auf genau dieser Position (Trainee soll dort üben) */
  solo: Uint8Array[];
  /** [c] – Lotsenzeit, die schon fest eingeplant ist (zählt für die faire Verteilung) */
  fixedMinutes: Float64Array;
  /** Index je Station-ID bzw. CID */
  stationIndex: Map<number, number>;
  controllerIndex: Map<number, number>;
}

const overlaps = (a: number, b: number, x: number, y: number) => a < y && x < b;

/** Zeitraum minus eine Menge anderer Zeiträume */
export function subtractRanges(
  base: TimeRangeMinutes,
  minus: TimeRangeMinutes[]
): TimeRangeMinutes[] {
  let rest: TimeRangeMinutes[] = [base];
  for (const m of minus) {
    const next: TimeRangeMinutes[] = [];
    for (const r of rest) {
      if (!overlaps(r.start, r.end, m.start, m.end)) {
        next.push(r);
        continue;
      }
      if (m.start > r.start) next.push({ start: r.start, end: m.start });
      if (m.end < r.end) next.push({ start: m.end, end: r.end });
    }
    rest = next;
  }
  return rest.filter((r) => r.end > r.start);
}

export function buildModel(input: PlanningInput, options: PlannerOptions): PlanningModel {
  const total = Math.max(0, input.totalMinutes);
  const slot = Math.max(5, input.slotMinutes);
  const slotCount = Math.ceil(total / slot);
  const starts: number[] = [];
  const ends: number[] = [];
  for (let t = 0; t < slotCount; t++) {
    starts.push(t * slot);
    ends.push(Math.min(total, (t + 1) * slot));
  }

  const excludedStations = new Set(options.excludedStationIds);
  const stations = sortByPriority(input.stations.filter((s) => !excludedStations.has(s.id)));
  const levels = stations.map(stationLevel);

  const excludedCids = new Set(input.excludedCids ?? []);
  const controllers = input.controllers.filter((c) => !c.withdrawn && !excludedCids.has(c.cid));

  const stationIndex = new Map(stations.map((s, i) => [s.id, i]));
  const controllerIndex = new Map(controllers.map((c, i) => [c.cid, i]));

  // Stationen: offen ist ein Slot nur, wenn kein fester Block hineinragt
  const open = stations.map((s) => {
    const row = new Uint8Array(slotCount);
    const blocks = input.fixed.filter((f) => f.stationId === s.id);
    for (let t = 0; t < slotCount; t++) {
      row[t] = blocks.some((f) => overlaps(f.start, f.end, starts[t], ends[t])) ? 0 : 1;
    }
    return row;
  });
  const openRanges = stations.map((s) =>
    subtractRanges(
      { start: 0, end: total },
      input.fixed.filter((f) => f.stationId === s.id)
    )
  );

  const eligible = controllers.map((c) => {
    const row = new Uint8Array(stations.length);
    stations.forEach((s, i) => {
      row[i] = checkEligibility(c, s.meta, input.eventAirports).ok ? 1 : 0;
    });
    return row;
  });

  const available: Uint8Array[] = [];
  const free: Uint8Array[] = [];
  for (const c of controllers) {
    const own = input.fixed.filter((f) => f.userCID === c.cid);
    // Feste Schichten auf einer Station verlangen Abstand für die Pause;
    // persönliche Blöcke ("Mentor") sind keine Lotsenzeit, nur belegt.
    const shifts = own.filter((f) => f.stationId !== null);
    const av = new Uint8Array(slotCount);
    const fr = new Uint8Array(slotCount);
    for (let t = 0; t < slotCount; t++) {
      const a = starts[t];
      const b = ends[t];
      const ok = !isUnavailable(c, a, b) && !own.some((f) => overlaps(f.start, f.end, a, b));
      av[t] = ok ? 1 : 0;
      fr[t] =
        ok &&
        !shifts.some((f) => overlaps(f.start - options.minBreak, f.end + options.minBreak, a, b))
          ? 1
          : 0;
    }
    available.push(av);
    free.push(fr);
  }

  const prefers = controllers.map((c) => {
    const wish = c.preferredStations.toUpperCase();
    return Uint8Array.from(stations, (s) =>
      options.respectPreferences && wish.includes(s.callsign.toUpperCase()) ? 1 : 0
    );
  });
  const solo = controllers.map((c) =>
    Uint8Array.from(stations, (s) => {
      const data = endorsementDataForStation(c.entry, s.meta.airport, input.eventAirports);
      return data?.soloPositions?.includes(s.callsign.toUpperCase()) ? 1 : 0;
    })
  );

  const fixedMinutes = Float64Array.from(controllers, (c) =>
    input.fixed
      .filter((f) => f.userCID === c.cid && f.stationId !== null)
      .reduce((sum, f) => sum + (f.end - f.start), 0)
  );

  return {
    options,
    eventAirports: input.eventAirports,
    total,
    slot,
    slotCount,
    starts,
    ends,
    stations,
    levels,
    controllers,
    fixed: input.fixed,
    eligible,
    available,
    free,
    open,
    openRanges,
    prefers,
    solo,
    fixedMinutes,
    stationIndex,
    controllerIndex,
  };
}
