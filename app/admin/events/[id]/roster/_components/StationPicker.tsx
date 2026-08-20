"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractStationGroup, STATION_GROUP_ORDER } from "@/lib/weeklys/stationUtils";
import { airportTintColors } from "@/lib/roster/stationColors";
import type { Station } from "@/lib/stations/types";


interface StationPickerProps {
  /** Bereits ausgewählte Callsigns */
  selected: string[];
  /** Vorschläge aus dem Datahub (alle Airports des Events) */
  available: Station[];
  eventAirports: string[];
  onToggle: (callsign: string) => void;
  /** Zusatzangabe je Station, z. B. Anzahl bestehender Zuweisungen */
  countFor?: (callsign: string) => number;
}

const airportOf = (callsign: string) =>
  /^[A-Z]{4}/i.test(callsign) ? callsign.slice(0, 4).toUpperCase() : "Weitere";

const groupRank = (callsign: string) => {
  const g = extractStationGroup(callsign);
  return g ? STATION_GROUP_ORDER.indexOf(g) : 99;
};

/** Nach Ebene sortieren (DEL → CTR), bei Gleichstand alphabetisch */
function byGroupThenName(a: string, b: string): number {
  return groupRank(a) - groupRank(b) || a.localeCompare(b);
}

/**
 * Stationsauswahl, nach Airport gegliedert.
 *
 * Eine einzige lange Liste taugt bei Events über mehrere Airports nicht: Man
 * sucht immer die Stationen eines bestimmten Platzes, und in einer gemischten
 * alphabetischen Aufzählung sind die eines Airports über die ganze Liste
 * verstreut. Innerhalb eines Airports steht die Reihenfolge DEL → CTR, weil
 * so auch der Plan aufgebaut wird.
 */
export function StationPicker({
  selected,
  available,
  eventAirports,
  onToggle,
  countFor,
}: StationPickerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toUpperCase())),
    [selected]
  );

  /** Alle bekannten Callsigns je Airport – ausgewählte und verfügbare zusammen */
  const groups = useMemo(() => {
    const byAirport = new Map<string, Set<string>>();
    const add = (callsign: string) => {
      const cs = callsign.toUpperCase();
      const ap = airportOf(cs);
      const set = byAirport.get(ap);
      if (set) set.add(cs);
      else byAirport.set(ap, new Set([cs]));
    };
    for (const cs of selected) add(cs);
    for (const st of available) add(st.callsign);

    // Reihenfolge: Event-Airports zuerst, danach alles Übrige alphabetisch
    const order = new Map(eventAirports.map((a, i) => [a.toUpperCase(), i]));
    return [...byAirport.entries()]
      .map(([airport, set]) => ({
        airport,
        stations: [...set].sort(byGroupThenName),
      }))
      .sort((a, b) => {
        const d = (order.get(a.airport) ?? 900) - (order.get(b.airport) ?? 900);
        return d !== 0 ? d : a.airport.localeCompare(b.airport);
      });
  }, [selected, available, eventAirports]);

  const toggleAll = (stations: string[], select: boolean) => {
    for (const cs of stations) {
      if (selectedSet.has(cs) !== select) onToggle(cs);
    }
  };

  // Ein Airport bringt rund zwanzig Stationen mit. Bei mehreren Airports wäre
  // die Liste damit länger als das Fenster, und man sähe beim Öffnen nur den
  // ersten Platz – genau der Eindruck, es gäbe wieder nur einen. Deshalb sind
  // die Gruppen zugeklappt und die Kopfzeile verrät, wie viel schon gewählt
  // ist. Nur ein einzelner Airport bleibt offen, dort gibt es nichts zu suchen.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const isCollapsed = (airport: string, hasSelection: boolean) => {
    if (touched) return collapsed.has(airport);
    return groups.length > 1 && !hasSelection;
  };
  const toggleCollapse = (airport: string, currentlyCollapsed: boolean) => {
    setCollapsed((prev) => {
      // Beim ersten Klick den bisher nur errechneten Zustand festhalten,
      // damit sich die übrigen Gruppen nicht mitbewegen.
      const next = touched
        ? new Set(prev)
        : new Set(
            groups
              .filter((g) => !g.stations.some((cs) => selectedSet.has(cs)))
              .map((g) => g.airport)
          );
      if (currentlyCollapsed) next.delete(airport);
      else next.add(airport);
      return next;
    });
    setTouched(true);
  };

  return (
    <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-1">
      {groups.map((group) => {
        const tint = airportTintColors(
          group.airport === "Weitere" ? null : group.airport,
          eventAirports,
          isDark
        );
        const chosen = group.stations.filter((cs) => selectedSet.has(cs));
        const allChosen = chosen.length === group.stations.length;
        const folded = isCollapsed(group.airport, chosen.length > 0);
        return (
          <div key={group.airport} className="rounded-lg border overflow-hidden">
            <div
              className={cn(
                "flex items-center gap-2 px-1.5 py-1.5",
                !folded && "border-b"
              )}
              style={{ backgroundColor: tint.background, borderColor: tint.border }}
            >
              <button
                type="button"
                onClick={() => toggleCollapse(group.airport, folded)}
                className="flex flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-black/5"
                aria-expanded={!folded}
              >
                {folded ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold">{group.airport}</span>
                <span className="text-[11px] text-muted-foreground">
                  {chosen.length} von {group.stations.length} gewählt
                </span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => toggleAll(group.stations, !allChosen)}
              >
                {allChosen ? "Keine" : "Alle"}
              </Button>
            </div>
            <div
              className={cn("grid grid-cols-2 sm:grid-cols-3 gap-1 p-2", folded && "hidden")}
            >
              {group.stations.map((cs) => {
                const isSelected = selectedSet.has(cs);
                const count = countFor?.(cs) ?? 0;
                return (
                  <label
                    key={cs}
                    className={cn(
                      "flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer transition-colors",
                      isSelected ? "bg-accent-500/10" : "hover:bg-muted"
                    )}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggle(cs)} />
                    <span className="truncate">{cs}</span>
                    {count > 0 && (
                      <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Stationen gefunden.</p>
      )}
    </div>
  );
}

/** Ausgewählte Stationen als entfernbare Chips, nach Airport und Ebene sortiert */
export function SelectedStationList({
  selected,
  eventAirports,
  onRemove,
  countFor,
}: {
  selected: string[];
  eventAirports: string[];
  onRemove: (callsign: string) => void;
  countFor?: (callsign: string) => number;
}) {
  const groups = useMemo(() => {
    const order = new Map(eventAirports.map((a, i) => [a.toUpperCase(), i]));
    const byAirport = new Map<string, string[]>();
    for (const cs of selected.map((s) => s.toUpperCase())) {
      const ap = airportOf(cs);
      const list = byAirport.get(ap);
      if (list) list.push(cs);
      else byAirport.set(ap, [cs]);
    }
    return [...byAirport.entries()]
      .map(([airport, list]) => ({ airport, stations: list.sort(byGroupThenName) }))
      .sort((a, b) => {
        const d = (order.get(a.airport) ?? 900) - (order.get(b.airport) ?? 900);
        return d !== 0 ? d : a.airport.localeCompare(b.airport);
      });
  }, [selected, eventAirports]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {groups.map((group) => (
        <div key={group.airport} className="flex items-start gap-2">
          <span className="mt-1 w-14 shrink-0 text-[11px] font-semibold text-muted-foreground">
            {group.airport}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {group.stations.map((cs) => {
              const count = countFor?.(cs) ?? 0;
              return (
                <Badge key={cs} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                  {cs}
                  {count > 0 && (
                    <span className="text-[10px] text-muted-foreground">({count})</span>
                  )}
                  <button
                    onClick={() => onRemove(cs)}
                    className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`${cs} entfernen`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
