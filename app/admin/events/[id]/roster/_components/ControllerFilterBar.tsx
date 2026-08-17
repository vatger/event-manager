"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownUp, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ROSTER_FLAGS,
  ROSTER_FLAG_DOT,
  ROSTER_FLAG_HINT,
  ROSTER_FLAG_LABEL,
  type RosterFlag,
} from "@/lib/roster/rosterFlags";
import type { RosterStation } from "../_lib/rosterTypes";

export type ControllerSort = "name" | "assigned" | "flag";

interface ControllerFilterBarProps {
  /** Anzahl der Zeilen nach Filterung, für die Kopfzeile */
  visibleCount: number;
  totalCount: number;

  search: string;
  onSearchChange: (value: string) => void;
  /** Trifft der Suchtext Stationen? Dann wird das in der Suche quittiert. */
  matchedStations: string[];

  sort: ControllerSort;
  onSortChange: (value: ControllerSort) => void;

  /** Airports des Events – bei mehreren erscheint der Airport-Filter */
  eventAirports: string[];
  airportFilter: string | null;
  onAirportFilterChange: (airport: string | null) => void;

  /** Stationen, gefiltert auf den gewählten Airport */
  stations: RosterStation[];
  stationFilter: number | null;
  onStationFilterChange: (stationId: number | null) => void;

  onlyUnscheduled: boolean;
  onOnlyUnscheduledChange: (value: boolean) => void;

  flagFilter: Set<RosterFlag>;
  flagCounts: Record<RosterFlag, number>;
  onToggleFlag: (flag: RosterFlag) => void;

  onReset: () => void;
  hasActiveFilter: boolean;
}

/**
 * Filter- und Ansichtsleiste des Controller-Boards.
 *
 * Beim Planen wechseln sich zwei Fragen ab: „wer darf hier sitzen?" und „was
 * muss ich über diese Person wissen?". Die Leiste ordnet die Bedienelemente
 * danach: links das Eingrenzen der Liste (Suche, Airport, Station, Zustand),
 * rechts die Darstellung (Sortierung, Spalten). Dadurch bleibt sie auch mit
 * sechs Bedienelementen lesbar.
 */
export function ControllerFilterBar({
  visibleCount,
  totalCount,
  search,
  onSearchChange,
  matchedStations,
  sort,
  onSortChange,
  eventAirports,
  airportFilter,
  onAirportFilterChange,
  stations,
  stationFilter,
  onStationFilterChange,
  onlyUnscheduled,
  onOnlyUnscheduledChange,
  flagFilter,
  flagCounts,
  onToggleFlag,
  onReset,
  hasActiveFilter,
}: ControllerFilterBarProps) {
  const multiAirport = eventAirports.length > 1;

  return (
    <div className="flex items-center gap-2 flex-nowrap">
      {/* --- Liste eingrenzen --- */}
      <div className="relative shrink-0">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Name, CID, Station, Remarks…"
          className={cn(
            "h-7 w-56 pl-7 pr-6 text-xs",
            matchedStations.length > 0 && "border-accent-500/60"
          )}
          title="Nach Name, CID, Wunsch, Remarks oder Notiz suchen. Ein Stations-Callsign zeigt alle, die diese Station besetzen dürfen."
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Suche leeren"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Quittung, dass die Suche als Stationssuche gelesen wurde */}
      {matchedStations.length > 0 && (
        <span
          className="shrink-0 whitespace-nowrap rounded-full border border-accent-500/50 bg-accent-500/10 px-2 py-0.5 text-[10px] leading-none text-accent-600"
          title={`Zeigt alle, die ${matchedStations.join(", ")} besetzen dürfen`}
        >
          geeignet für {matchedStations.slice(0, 2).join(", ")}
          {matchedStations.length > 2 && ` +${matchedStations.length - 2}`}
        </span>
      )}

      {multiAirport && (
        <Select
          value={airportFilter ?? "all"}
          onValueChange={(v) => onAirportFilterChange(v === "all" ? null : v)}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "h-7 w-28 shrink-0 text-xs",
              airportFilter !== null && "border-accent-500/60 text-accent-600"
            )}
            title="Auf einen Airport eingrenzen – die Freigaben beziehen sich dann auf ihn"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Airports</SelectItem>
            {eventAirports.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={stationFilter === null ? "all" : String(stationFilter)}
        onValueChange={(v) => onStationFilterChange(v === "all" ? null : Number(v))}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            "h-7 w-44 shrink-0 text-xs",
            stationFilter !== null && "border-accent-500/60 text-accent-600"
          )}
          title="Nur Controller zeigen, die diese Station besetzen dürfen"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Jede Station</SelectItem>
          {stations.map((st) => (
            <SelectItem key={st.id} value={String(st.id)}>
              Geeignet für {st.callsign}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={() => onOnlyUnscheduledChange(!onlyUnscheduled)}
        className={cn(
          "h-7 shrink-0 whitespace-nowrap rounded-md border px-2 text-xs transition-colors",
          onlyUnscheduled
            ? "border-accent-500/60 bg-accent-500/10 text-accent-600"
            : "text-muted-foreground hover:bg-muted"
        )}
        title="Nur Controller ohne jede Schicht zeigen"
      >
        ohne Schicht
      </button>

      {/* Ampel-Markierungen: nur zeigen, was auch vergeben wurde */}
      {ROSTER_FLAGS.some((f) => flagCounts[f] > 0) && (
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border px-1 py-0.5">
          {ROSTER_FLAGS.map((flag) =>
            flagCounts[flag] === 0 && !flagFilter.has(flag) ? null : (
              <button
                key={flag}
                type="button"
                onClick={() => onToggleFlag(flag)}
                title={`${ROSTER_FLAG_LABEL[flag]} – ${ROSTER_FLAG_HINT[flag]} (${flagCounts[flag]})`}
                className={cn(
                  "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-none transition-colors",
                  flagFilter.has(flag)
                    ? "bg-accent-500/15 text-accent-600"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", ROSTER_FLAG_DOT[flag])} />
                {flagCounts[flag]}
              </button>
            )
          )}
        </div>
      )}

      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
          title="Alle Filter zurücksetzen"
        >
          <X className="h-3.5 w-3.5" />
          {visibleCount} von {totalCount}
        </button>
      )}

      {/* --- Darstellung --- */}
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />

      <Select value={sort} onValueChange={(v) => onSortChange(v as ControllerSort)}>
        <SelectTrigger
          size="sm"
          className="h-7 w-9 shrink-0 justify-center px-0 text-xs [&>svg:last-child]:hidden"
          title="Sortierung"
          aria-label="Sortierung"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="name">Nach Name</SelectItem>
          <SelectItem value="assigned">Nach eingeplanter Zeit</SelectItem>
          <SelectItem value="flag">Nach Markierung</SelectItem>
        </SelectContent>
      </Select>

    </div>
  );
}

export default ControllerFilterBar;
