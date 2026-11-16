import type { TimeRange } from "@/types";

/**
 * Zeitraster der Anmeldung.
 *
 * Die Verfügbarkeit wird als Uhrzeiten ohne Datum gespeichert
 * (`{ available, unavailable }` mit "HH:mm"-Bereichen in UTC), im Raster
 * des Events ab dem auf den Slot abgerundeten Beginn. Dieses Modul übersetzt
 * zwischen diesem Format und einer Liste von Slots, mit der sich im Formular
 * rechnen lässt – im selben Format wie bisher, damit Editor, Export und
 * Machbarkeitsprüfung unverändert weiterlesen.
 */

export interface AvailabilitySlot {
  /** "HH:mm" (UTC) – Beginn des Slots, so wie er gespeichert wird */
  label: string;
  /** Minuten seit 1970 (UTC) – für Ortszeit und Stundengruppen */
  startMinute: number;
}

export interface AvailabilityGrid {
  slotMinutes: number;
  slots: AvailabilitySlot[];
  /** "HH:mm" des Endes, wie es als Ende des letzten Bereichs gespeichert wird */
  endLabel: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function hm(minuteOfEpoch: number): string {
  const m = ((minuteOfEpoch % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Raster eines Events: Beginn abgerundet, Ende aufgerundet auf den Slot */
export function buildAvailabilityGrid(
  startIso: string | Date,
  endIso: string | Date,
  slotMinutes = 30
): AvailabilityGrid {
  const slot = slotMinutes > 0 ? slotMinutes : 30;
  const start = Math.floor(new Date(startIso).getTime() / 60000 / slot) * slot;
  let end = Math.ceil(new Date(endIso).getTime() / 60000 / slot) * slot;
  if (end <= start) end = start + slot;
  const slots: AvailabilitySlot[] = [];
  for (let m = start; m < end; m += slot) slots.push({ label: hm(m), startMinute: m });
  return { slotMinutes: slot, slots, endLabel: hm(end) };
}

/**
 * Gespeicherte Verfügbarkeit → je Slot „nicht verfügbar".
 *
 * Bereiche, die nicht ins Raster passen (etwa nach einer Verschiebung des
 * Events), fallen weg – wie bisher im Formular.
 */
export function blockedFromAvailability(
  grid: AvailabilityGrid,
  availability: { available?: TimeRange[]; unavailable?: TimeRange[] } | null | undefined
): boolean[] {
  const blocked = new Array<boolean>(grid.slots.length).fill(false);
  const index = new Map(grid.slots.map((s, i) => [s.label, i]));
  for (const r of availability?.unavailable ?? []) {
    const from = index.get(r?.start);
    if (from === undefined) continue;
    const to = r.end === grid.endLabel && !index.has(r.end) ? grid.slots.length : index.get(r.end);
    if (to === undefined) continue;
    // Ende vor Beginn: Bereich über das Rasterende (00:00 = Event-Ende)
    const stop = to > from ? to : grid.slots.length;
    for (let i = from; i < stop; i++) blocked[i] = true;
  }
  return blocked;
}

/** Zusammenhängende Slot-Bereiche mit demselben Wert */
export function slotRuns(values: boolean[], wanted: boolean): { from: number; to: number }[] {
  const runs: { from: number; to: number }[] = [];
  let i = 0;
  while (i < values.length) {
    if (values[i] !== wanted) {
      i++;
      continue;
    }
    const from = i;
    while (i < values.length && values[i] === wanted) i++;
    runs.push({ from, to: i });
  }
  return runs;
}

function runToRange(grid: AvailabilityGrid, run: { from: number; to: number }): TimeRange {
  return {
    start: grid.slots[run.from].label,
    end: run.to < grid.slots.length ? grid.slots[run.to].label : grid.endLabel,
  };
}

/** Je Slot „nicht verfügbar" → Speicherformat der Anmeldung */
export function availabilityFromBlocked(
  grid: AvailabilityGrid,
  blocked: boolean[]
): { available: TimeRange[]; unavailable: TimeRange[] } {
  return {
    available: slotRuns(blocked, false).map((r) => runToRange(grid, r)),
    unavailable: slotRuns(blocked, true).map((r) => runToRange(grid, r)),
  };
}

/** Verfügbare Zeitspannen, die kürzer als die Mindestdauer sind */
export function shortAvailableRuns(
  grid: AvailabilityGrid,
  blocked: boolean[],
  minMinutes = 60
): TimeRange[] {
  const minSlots = Math.ceil(minMinutes / grid.slotMinutes);
  return slotRuns(blocked, false)
    .filter((r) => r.to - r.from < minSlots)
    .map((r) => runToRange(grid, r));
}

/** Verfügbare Minuten insgesamt */
export function availableMinutes(grid: AvailabilityGrid, blocked: boolean[]): number {
  return blocked.filter((b) => !b).length * grid.slotMinutes;
}
