"use client";

import { useMemo, useRef } from "react";
import { Check, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailabilityGrid } from "@/lib/signups/availabilitySlots";

/**
 * Verfügbarkeit im Anmeldedialog.
 *
 * Eine Zeile je Stunde, darin die Slots. Antippen schaltet einen Slot um,
 * die Stunde links schaltet die ganze Stunde. Mit der Maus lässt sich über
 * mehrere Slots ziehen; auf dem Handy bleibt es beim Antippen, damit das
 * Scrollen durch die Liste nicht hängen bleibt.
 *
 * `onlyExtend` (nach dem Anmeldeschluss): Slots, die beim Öffnen verfügbar
 * waren, bleiben verfügbar – freigeben ja, streichen nein.
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
  initiallyBlocked: boolean[];
}) {
  const paint = useRef<boolean | null>(null);
  // Die Maus schaltet schon beim Drücken; der folgende click darf nicht noch
  // einmal umschalten
  const handledByMouse = useRef(false);

  const canBlock = (i: number) => !onlyExtend || initiallyBlocked[i];

  const rows = useMemo(() => {
    const byHour = new Map<number, number[]>();
    grid.slots.forEach((s, i) => {
      const hour = Math.floor(s.startMinute / 60);
      byHour.set(hour, [...(byHour.get(hour) ?? []), i]);
    });
    return [...byHour.entries()].map(([hour, idx]) => ({
      hour,
      label: `${String(((hour % 24) + 24) % 24).padStart(2, "0")}z`,
      local: new Date(hour * 3600000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      idx,
    }));
  }, [grid]);

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

  const toggleHour = (idx: number[]) => {
    // Ist irgendwas in der Stunde gesperrt, wird alles frei – sonst gesperrt
    const anyBlocked = idx.some((i) => blocked[i]);
    setSlots(idx, !anyBlocked);
  };

  const slotsPerRow = Math.max(...rows.map((r) => r.idx.length), 1);
  // Erste Stunde kann angebrochen sein: Slots rechtsbündig in die Spalten setzen
  const columnOf = (i: number) => {
    const minuteInHour = ((grid.slots[i].startMinute % 60) + 60) % 60;
    return Math.floor(minuteInHour / grid.slotMinutes);
  };

  return (
    <div
      className="space-y-1.5 select-none"
      onPointerUp={() => (paint.current = null)}
      onPointerLeave={() => (paint.current = null)}
    >
      {rows.map((row) => {
        const anyBlocked = row.idx.some((i) => blocked[i]);
        const allBlocked = row.idx.every((i) => blocked[i]);
        return (
          <div key={row.hour} className="flex items-stretch gap-1.5">
            <button
              type="button"
              onClick={() => toggleHour(row.idx)}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center justify-center rounded-md border px-1 py-1 text-xs transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                allBlocked
                  ? "border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200"
                  : anyBlocked
                  ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                  : "border-success-300 bg-success-50 text-success-800 dark:border-success-800 dark:bg-success-900/20 dark:text-success-300"
              )}
              title={anyBlocked ? "Ganze Stunde verfügbar machen" : "Ganze Stunde als nicht verfügbar markieren"}
              aria-label={`${row.label}: ${anyBlocked ? "ganze Stunde verfügbar machen" : "ganze Stunde sperren"}`}
            >
              <span className="font-semibold tabular-nums">{row.label}</span>
              <span className="text-[10px] tabular-nums opacity-70">{row.local}</span>
            </button>
            <div
              className="grid flex-1 gap-1.5"
              style={{ gridTemplateColumns: `repeat(${slotsPerRow}, minmax(0, 1fr))` }}
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
                    title={
                      fixed
                        ? "Nach dem Anmeldeschluss kannst du keine Zeiten mehr streichen"
                        : isBlocked
                        ? "Antippen: verfügbar"
                        : "Antippen: nicht verfügbar"
                    }
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
                      // Touch und Tastatur
                      setSlots([i], !isBlocked);
                    }}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1 rounded-md border text-xs font-medium tabular-nums transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isBlocked
                        ? "border-danger-300 bg-[repeating-linear-gradient(135deg,rgba(239,68,68,0.18)_0_4px,transparent_4px_8px)] text-danger-800 dark:border-danger-800 dark:text-danger-200"
                        : fixed
                        ? "cursor-default border-success-300 bg-success-100 text-success-900 dark:border-success-800 dark:bg-success-900/30 dark:text-success-200"
                        : "border-success-300 bg-success-100 text-success-900 hover:bg-success-200 dark:border-success-800 dark:bg-success-900/30 dark:text-success-200 dark:hover:bg-success-900/50"
                    )}
                  >
                    {isBlocked ? (
                      <X className="h-3 w-3 shrink-0" />
                    ) : fixed ? (
                      <Lock className="h-3 w-3 shrink-0 opacity-60" />
                    ) : (
                      <Check className="h-3 w-3 shrink-0" />
                    )}
                    {grid.slots[i].label}
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
