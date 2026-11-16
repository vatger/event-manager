"use client";

import { useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailabilityGrid } from "@/lib/signups/availabilitySlots";

/**
 * Verfügbarkeit: eine Zeile je Stunde, darin die Slots.
 *
 * Antippen schaltet einen Slot um, die Stunde links die ganze Stunde; mit der
 * Maus lässt sich über mehrere Slots ziehen. Auf dem Handy bleibt es beim
 * Antippen, damit das Scrollen nicht hängen bleibt.
 *
 * `onlyExtend` (Lotsen nach dem Anmeldeschluss): Slots, die beim Öffnen
 * verfügbar waren, bleiben verfügbar.
 */
export function AvailabilityPicker({
  grid,
  blocked,
  onChange,
  onlyExtend = false,
  initiallyBlocked,
}: {
  grid: AvailabilityGrid;
  blocked: boolean[];
  onChange: (next: boolean[]) => void;
  onlyExtend?: boolean;
  /** Stand beim Öffnen – nur diese Slots dürfen bei onlyExtend gesperrt werden */
  initiallyBlocked?: boolean[];
}) {
  const paint = useRef<boolean | null>(null);
  // Die Maus schaltet schon beim Drücken; der folgende click nicht noch einmal
  const handledByMouse = useRef(false);

  const canBlock = (i: number) => !onlyExtend || !!initiallyBlocked?.[i];

  const rows = useMemo(() => {
    const byHour = new Map<number, number[]>();
    grid.slots.forEach((s, i) => {
      const hour = Math.floor(s.startMinute / 60);
      byHour.set(hour, [...(byHour.get(hour) ?? []), i]);
    });
    return [...byHour.entries()].map(([hour, idx]) => ({
      hour,
      label: `${String(((hour % 24) + 24) % 24).padStart(2, "0")}z`,
      local: new Date(hour * 3600000).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      idx,
    }));
  }, [grid]);

  const perHour = Math.max(1, Math.round(60 / grid.slotMinutes));
  const columnOf = (i: number) =>
    Math.floor((((grid.slots[i].startMinute % 60) + 60) % 60) / grid.slotMinutes);

  const setSlots = (indices: number[], value: boolean) => {
    const next = [...blocked];
    let changed = false;
    for (const i of indices) {
      if (value && !canBlock(i)) continue;
      if (next[i] !== value) {
        next[i] = value;
        changed = true;
      }
    }
    if (changed) onChange(next);
  };

  return (
    <div
      className="space-y-2 select-none"
      onPointerUp={() => (paint.current = null)}
      onPointerLeave={() => (paint.current = null)}
    >
      {rows.map((row) => {
        const anyBlocked = row.idx.some((i) => blocked[i]);
        return (
          <div key={row.hour} className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setSlots(row.idx, !anyBlocked)}
              className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md text-sm tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${row.label}: ganze Stunde umschalten`}
              title="Ganze Stunde umschalten"
            >
              <span className="font-semibold leading-tight">{row.label}</span>
              <span className="text-xs leading-tight text-muted-foreground">{row.local}</span>
            </button>
            <div
              className="grid flex-1 gap-2"
              style={{ gridTemplateColumns: `repeat(${perHour}, minmax(0, 1fr))` }}
            >
              {row.idx.map((i) => {
                const isBlocked = blocked[i];
                const fixed = !isBlocked && !canBlock(i);
                return (
                  <button
                    key={i}
                    type="button"
                    style={{ gridColumnStart: columnOf(i) + 1 }}
                    aria-pressed={!isBlocked}
                    aria-label={`${grid.slots[i].label}z ${isBlocked ? "nicht verfügbar" : "verfügbar"}`}
                    title={fixed ? "Nach dem Anmeldeschluss nicht mehr streichbar" : undefined}
                    onPointerDown={(e) => {
                      if (e.pointerType !== "mouse" || e.button !== 0) return;
                      paint.current = !isBlocked;
                      handledByMouse.current = true;
                      setSlots([i], !isBlocked);
                      e.preventDefault();
                    }}
                    onPointerEnter={() => {
                      if (paint.current !== null) setSlots([i], paint.current);
                    }}
                    onClick={() => {
                      if (handledByMouse.current) {
                        handledByMouse.current = false;
                        return;
                      }
                      setSlots([i], !isBlocked);
                    }}
                    className={cn(
                      "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium tabular-nums transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isBlocked
                        ? "border-dashed border-secondary-300 bg-secondary-50 text-secondary-500 hover:bg-secondary-100 dark:border-secondary-700 dark:bg-transparent dark:text-secondary-400 dark:hover:bg-secondary-900"
                        : "border-success-300 bg-success-100 text-success-900 shadow-xs dark:border-success-800 dark:bg-success-900/40 dark:text-success-100",
                      !isBlocked && !fixed && "hover:bg-success-200 dark:hover:bg-success-900/60",
                      fixed && "cursor-default"
                    )}
                  >
                    {!isBlocked && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span className={cn(isBlocked && "line-through")}>{grid.slots[i].label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AvailabilityPicker;
