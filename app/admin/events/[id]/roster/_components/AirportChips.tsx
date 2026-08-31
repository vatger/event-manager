"use client";

import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import {
  buildEndorsementView,
  dropReason,
  hasEndorsementGap,
  type AirportState,
} from "../_lib/endorsementView";
import type { SignupTableEntry } from "@/lib/cache/types";

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

/** Ab so vielen Airports wird zusammengefasst statt aufgezählt */
const COMPACT_FROM = 4;

function chipClass(state: AirportState, text: string): string {
  return cn(
    "inline-flex items-center gap-1 rounded px-1 py-0.5 leading-none",
    text,
    state.levels.length > 0
      ? getBadgeClassForEndorsement(state.levels[state.levels.length - 1])
      : "bg-muted text-muted-foreground"
  );
}

function titleFor(state: AirportState): string {
  return `${state.airport}: ${state.levels.join(", ")}${
    state.restrictions.length > 0 ? ` – ${state.restrictions.join("; ")}` : ""
  }`;
}

/**
 * Freigaben je Airport.
 *
 * Gezeigt werden nur Plätze, an denen sich tatsächlich etwas besetzen lässt.
 * Center läuft nicht mit: Die Freigabe gilt für die FIR, und welcher Sektor
 * erlaubt ist, entscheiden die Familiarisierungen – in jeder Airport-Zeile
 * stünde dieselbe Aussage noch einmal. Sie steht deshalb einmal in der
 * Seitenleiste.
 *
 * Bei vielen Plätzen wird zusätzlich die häufigste Kombination gebündelt und
 * nur Abweichungen stehen einzeln daneben; die vollständige Liste samt der
 * ausgefallenen Plätze ist einen Klick entfernt.
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
  const view = useMemo(
    () => buildEndorsementView(entry, eventAirports),
    [entry, eventAirports]
  );

  const text = size === "sm" ? "text-[9px]" : "text-[10px]";

  // Häufigste Kombination bestimmen – sie bildet den „Normalfall"
  const { common, commonCount, deviations } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of view.usable) counts.set(s.key, (counts.get(s.key) ?? 0) + 1);
    let bestKey: string | null = null;
    let best = 0;
    for (const [k, n] of counts) {
      if (n > best) {
        best = n;
        bestKey = k;
      }
    }
    return {
      common: view.usable.find((s) => s.key === bestKey) ?? null,
      commonCount: best,
      deviations: view.usable.filter((s) => s.key !== bestKey),
    };
  }, [view.usable]);

  // Bei einem einzigen Airport sagt das Rating-Badge daneben schon alles –
  // außer es gibt eine Lücke in den Freigaben oder eine Einschränkung.
  if (eventAirports.length < 2 && !always) {
    const data = entry.airportEndorsements?.[eventAirports[0] ?? ""];
    const worth = hasEndorsementGap(data) || (data?.restrictions?.length ?? 0) > 0;
    if (!worth) return null;
  }

  const compact = !expanded && view.usable.length >= COMPACT_FROM && commonCount > 1;
  /** Nur Einschränkungen, die wirklich an diesem Platz hängen */
  const ownRestrictions = (s: AirportState) =>
    s.restrictions.filter((r) => !view.commonRestrictions.includes(r));

  const chip = (state: AirportState, label: string) => (
    <span key={state.airport} title={titleFor(state)} className={chipClass(state, text)}>
      {label}
      <span className="font-semibold">{state.levels.join("/")}</span>
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
              title={`${commonCount} Airports: ${common.levels.join(", ")}`}
            >
              <span className="opacity-80">{commonCount}×</span>
              <span className="font-semibold">{common.levels.join("/")}</span>
            </span>
            {/* Nur die Abweichungen einzeln */}
            {deviations.map((s) => chip(s, s.airport))}
          </>
        ) : (
          view.usable.map((s) => chip(s, eventAirports.length > 1 ? s.airport : ""))
        )}

        {view.usable.length === 0 && (
          <span className={cn("text-muted-foreground", text)}>
            kein Platz besetzbar
          </span>
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
                {[...view.usable, ...view.dropped].map((s) => (
                  <li key={s.airport} className="flex items-center gap-2 text-xs">
                    <span className="w-12 shrink-0 font-medium">{s.airport}</span>
                    <span className="min-w-0 flex-1">
                      {s.levels.length > 0 ? (
                        s.levels.join(", ")
                      ) : (
                        <span
                          className={cn(
                            "text-muted-foreground",
                            s.excluded && "line-through"
                          )}
                        >
                          {dropReason(s)}
                        </span>
                      )}
                      {ownRestrictions(s).length > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          {ownRestrictions(s).join(" · ")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {view.commonRestrictions.length > 0 && (
                <p className="mt-1.5 border-t pt-1.5 text-[10px] text-muted-foreground">
                  überall: {view.commonRestrictions.join(" · ")}
                </p>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Ausgefallene Plätze in einer Zeile – dass jemand einen Platz abgewählt
          hat, ist beim Planen genauso eine Information wie eine fehlende
          Freigabe, nur keine, die eigene Chips verdient. */}
      {view.dropped.length > 0 && (expanded || eventAirports.length < COMPACT_FROM) && (
        <p className={cn("text-muted-foreground", text)}>
          {view.dropped.map((s) => `${s.airport}: ${dropReason(s)}`).join(" · ")}
        </p>
      )}

      {/* Einschränkungen sind für die Planung genauso wichtig wie die Freigabe.
          Was überall gleich lautet, steht einmal. */}
      {showRestrictions && (
        <>
          {view.commonRestrictions.length > 0 && (
            <p className={cn("text-muted-foreground", text)}>
              {eventAirports.length > 1 && <span className="font-medium">überall: </span>}
              {view.commonRestrictions.join(" · ")}
            </p>
          )}
          {view.usable.map((s) =>
            ownRestrictions(s).length === 0 ? null : (
              <p key={`r-${s.airport}`} className={cn("text-muted-foreground", text)}>
                {eventAirports.length > 1 && <span className="font-medium">{s.airport}: </span>}
                {ownRestrictions(s).join(" · ")}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

export default AirportChips;
