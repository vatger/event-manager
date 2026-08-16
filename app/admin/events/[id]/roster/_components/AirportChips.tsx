"use client";

import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { EventEndorsementData, SignupTableEntry } from "@/lib/cache/types";

interface AirportChipsProps {
  entry: SignupTableEntry;
  eventAirports: string[];
  /** Immer zeigen, auch ohne Auffälligkeit (Seitenleiste) */
  always?: boolean;
  /** Einschränkungen als eigene Zeile darunter */
  showRestrictions?: boolean;
  /** Alle Airports einzeln auflisten statt zusammenzufassen */
  expanded?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Reihenfolge der Ebenen für die Anzeige */
export const LEVELS = ["DEL", "GND", "TWR", "APP", "CTR"] as const;
export type Level = (typeof LEVELS)[number];

/** Ab so vielen Airports wird zusammengefasst statt aufgezählt */
const COMPACT_FROM = 4;

/**
 * Hat jemand eine Lücke in den Freigaben – also eine höhere Ebene ohne die
 * darunterliegende? Genau das ist der Fall, den eine Rangfolge verschluckt und
 * der beim Planen auffallen muss.
 */
export function hasEndorsementGap(data: EventEndorsementData | undefined): boolean {
  const levels = data?.allowedLevels ?? [];
  if (levels.length === 0) return false;
  const idx = LEVELS.map((l, i) => (levels.includes(l) ? i : -1)).filter((i) => i >= 0);
  const highest = Math.max(...idx);
  return idx.length !== highest + 1;
}

/** Freigegebene Ebenen eines Airports in fester Reihenfolge */
export function levelsFor(
  entry: SignupTableEntry,
  airport: string
): Level[] {
  const raw = entry.airportEndorsements?.[airport]?.allowedLevels ?? [];
  return LEVELS.filter((l) => raw.includes(l));
}

export function isAirportExcluded(entry: SignupTableEntry, airport: string): boolean {
  const excluded = entry.excludedAirports;
  return Array.isArray(excluded) && excluded.includes(airport);
}

/** Ein Airport mit seinem Freigabe-Zustand */
interface AirportState {
  airport: string;
  excluded: boolean;
  levels: Level[];
  restrictions: string[];
  /** Signatur zum Zusammenfassen gleichartiger Airports */
  key: string;
}

function buildStates(entry: SignupTableEntry, eventAirports: string[]): AirportState[] {
  return eventAirports.map((airport) => {
    const data = entry.airportEndorsements?.[airport];
    const excluded = isAirportExcluded(entry, airport);
    const levels = levelsFor(entry, airport);
    const restrictions = (data?.restrictions ?? []).filter(Boolean);
    return {
      airport,
      excluded,
      levels,
      restrictions,
      key: excluded ? "×" : `${levels.join("/")}|${restrictions.join(";")}`,
    };
  });
}

function chipClass(state: AirportState, text: string): string {
  return cn(
    "inline-flex items-center gap-1 rounded px-1 py-0.5 leading-none",
    text,
    state.excluded
      ? "bg-muted text-muted-foreground line-through decoration-danger-600/70"
      : state.levels.length > 0
      ? getBadgeClassForEndorsement(state.levels[state.levels.length - 1])
      : "bg-muted text-muted-foreground"
  );
}

function titleFor(state: AirportState): string {
  if (state.excluded) return `${state.airport}: bei der Anmeldung abgewählt`;
  if (state.levels.length === 0) return `${state.airport}: keine Freigabe`;
  return `${state.airport}: ${state.levels.join(", ")}${
    state.restrictions.length > 0 ? ` – ${state.restrictions.join("; ")}` : ""
  }`;
}

/**
 * Freigaben je Airport – zusammengefasst statt aufgezählt.
 *
 * Bei einem Event über acht Airports sind acht gleich aussehende Zeilen keine
 * Information, sondern Lärm: Interessant ist, was vom Normalfall abweicht.
 * Deshalb wird die häufigste Kombination zu einer Angabe gebündelt und nur
 * Abweichungen – andere Ebenen, Einschränkungen, abgewählte Airports – stehen
 * einzeln daneben. Die vollständige Liste steht einen Klick entfernt.
 */
export function AirportChips({
  entry,
  eventAirports,
  always = false,
  showRestrictions = false,
  expanded = false,
  size = "sm",
  className,
}: AirportChipsProps) {
  const [open, setOpen] = useState(false);
  const states = useMemo(
    () => buildStates(entry, eventAirports),
    [entry, eventAirports]
  );

  const text = size === "sm" ? "text-[9px]" : "text-[10px]";

  // Häufigste Kombination bestimmen – sie bildet den „Normalfall"
  const { common, commonCount, deviations } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of states) counts.set(s.key, (counts.get(s.key) ?? 0) + 1);
    let bestKey: string | null = null;
    let best = 0;
    for (const [k, n] of counts) {
      if (n > best) {
        best = n;
        bestKey = k;
      }
    }
    return {
      common: states.find((s) => s.key === bestKey) ?? null,
      commonCount: best,
      deviations: states.filter((s) => s.key !== bestKey),
    };
  }, [states]);

  // Bei einem einzigen Airport sagt das Rating-Badge daneben schon alles –
  // außer es gibt eine Lücke in den Freigaben oder eine Einschränkung.
  if (eventAirports.length < 2 && !always) {
    const data = entry.airportEndorsements?.[eventAirports[0] ?? ""];
    const worth = hasEndorsementGap(data) || (data?.restrictions?.length ?? 0) > 0;
    if (!worth) return null;
  }

  const compact = !expanded && eventAirports.length >= COMPACT_FROM && commonCount > 1;

  const chip = (state: AirportState, label: string) => (
    <span key={state.airport} title={titleFor(state)} className={chipClass(state, text)}>
      {label}
      {!state.excluded && (
        <span className="font-semibold">
          {state.levels.length > 0 ? state.levels.join("/") : "–"}
        </span>
      )}
    </span>
  );

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {compact && common ? (
          <>
            {/* Der Normalfall als eine Angabe */}
            <span
              className={chipClass(common, text)}
              title={`${commonCount} Airports: ${
                common.excluded ? "abgewählt" : common.levels.join(", ") || "keine Freigabe"
              }`}
            >
              <span className="opacity-80">{commonCount}×</span>
              {!common.excluded && (
                <span className="font-semibold">
                  {common.levels.length > 0 ? common.levels.join("/") : "–"}
                </span>
              )}
              {common.excluded && <span className="font-semibold">abgewählt</span>}
            </span>
            {/* Nur die Abweichungen einzeln */}
            {deviations.map((s) => chip(s, s.airport))}
          </>
        ) : (
          states.map((s) => chip(s, eventAirports.length > 1 ? s.airport : ""))
        )}

        {/* Vollständige Aufstellung auf Wunsch */}
        {eventAirports.length >= COMPACT_FROM && !expanded && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "rounded px-1 py-0.5 leading-none text-muted-foreground hover:bg-muted",
                  text
                )}
                title="Alle Airports einzeln zeigen"
              >
                alle
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-medium mb-1.5">Freigaben je Airport</p>
              <ul className="space-y-1">
                {states.map((s) => (
                  <li key={s.airport} className="flex items-center gap-2 text-xs">
                    <span className="w-12 shrink-0 font-medium">{s.airport}</span>
                    <span className="min-w-0 flex-1">
                      {s.excluded ? (
                        <span className="text-muted-foreground line-through">abgewählt</span>
                      ) : s.levels.length > 0 ? (
                        s.levels.join(", ")
                      ) : (
                        <span className="text-muted-foreground">keine Freigabe</span>
                      )}
                      {s.restrictions.length > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          {s.restrictions.join(" · ")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Einschränkungen sind für die Planung genauso wichtig wie die Freigabe.
          In der kompakten Fassung stehen sie gebündelt, sonst je Airport. */}
      {showRestrictions &&
        (compact ? (
          (() => {
            const all = states.filter((s) => s.restrictions.length > 0);
            if (all.length === 0) return null;
            return (
              <p className={cn("text-muted-foreground", text)}>
                {all
                  .map((s) => `${s.airport}: ${s.restrictions.join(" · ")}`)
                  .join(" | ")}
              </p>
            );
          })()
        ) : (
          states.map((s) =>
            s.restrictions.length === 0 ? null : (
              <p key={`r-${s.airport}`} className={cn("text-muted-foreground", text)}>
                {eventAirports.length > 1 && (
                  <span className="font-medium">{s.airport}: </span>
                )}
                {s.restrictions.join(" · ")}
              </p>
            )
          )
        ))}
    </div>
  );
}

export default AirportChips;
