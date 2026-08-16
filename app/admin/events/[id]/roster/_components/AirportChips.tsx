"use client";

import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { EventEndorsementData, SignupTableEntry } from "@/lib/cache/types";

interface AirportChipsProps {
  entry: SignupTableEntry;
  eventAirports: string[];
  /** Auch bei nur einem Airport zeigen (Seitenleiste) */
  always?: boolean;
  /** Einschränkungen als eigene Zeile darunter */
  showRestrictions?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Reihenfolge der Ebenen für die Anzeige */
const LEVELS = ["DEL", "GND", "TWR", "APP", "CTR"] as const;

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
  // Lückenlos hieße: alle Ebenen bis zur höchsten sind freigegeben
  return idx.length !== highest + 1;
}

/**
 * Welche Ebenen darf diese Person an welchem Airport wirklich besetzen?
 *
 * Die höchste Freigabe allein führt in die Irre: Wer APP darf, darf deshalb
 * nicht automatisch TWR oder GND desselben Airports – etwa wenn dort ein
 * T1-Endorsement fehlt oder CTR über eine FIR-Freigabe kommt. Deshalb stehen
 * hier die einzelnen freigegebenen Ebenen, nicht ein Rang.
 */
export function AirportChips({
  entry,
  eventAirports,
  always = false,
  showRestrictions = false,
  size = "sm",
  className,
}: AirportChipsProps) {
  // Bei einem einzigen Airport sagt das Rating-Badge daneben schon alles –
  // außer es gibt eine Lücke in den Freigaben oder eine Einschränkung. Dann
  // ist genau das die wichtigste Information der Zeile.
  if (eventAirports.length < 2 && !always) {
    const data = entry.airportEndorsements?.[eventAirports[0] ?? ""];
    const worthShowing =
      hasEndorsementGap(data) || (data?.restrictions?.length ?? 0) > 0;
    if (!worthShowing) return null;
  }

  const excluded = Array.isArray(entry.excludedAirports) ? entry.excludedAirports : [];
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";

  const restrictionsFor = (data: EventEndorsementData | undefined) =>
    (data?.restrictions ?? []).filter(Boolean);

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {eventAirports.map((airport) => {
          const data = entry.airportEndorsements?.[airport];
          const isExcluded = excluded.includes(airport);
          const levels = (data?.allowedLevels ?? []).filter((l) =>
            (LEVELS as readonly string[]).includes(l)
          );
          const sorted = LEVELS.filter((l) => levels.includes(l));

          const title = isExcluded
            ? `${airport}: bei der Anmeldung abgewählt`
            : sorted.length > 0
            ? `${airport}: freigegeben für ${sorted.join(", ")}${
                restrictionsFor(data).length > 0
                  ? ` – ${restrictionsFor(data).join("; ")}`
                  : ""
              }`
            : `${airport}: keine Freigabe${
                data?.group ? "" : " (oder keine Auswertung vorhanden)"
              }`;

          return (
            <span
              key={airport}
              title={title}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 py-0.5 leading-none",
                text,
                isExcluded
                  ? "bg-muted text-muted-foreground line-through decoration-danger-600/70"
                  : sorted.length > 0
                  ? getBadgeClassForEndorsement(sorted[sorted.length - 1])
                  : "bg-muted text-muted-foreground"
              )}
            >
              {eventAirports.length > 1 && airport}
              {!isExcluded && (
                <span className="font-semibold">
                  {sorted.length > 0 ? sorted.join("/") : "–"}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Einschränkungen wie „no TWR, GND" oder „WLD only" sind für die
          Planung genauso wichtig wie die Freigabe selbst. */}
      {showRestrictions &&
        eventAirports.map((airport) => {
          const rs = restrictionsFor(entry.airportEndorsements?.[airport]);
          if (rs.length === 0) return null;
          return (
            <p key={`r-${airport}`} className={cn("text-muted-foreground", text)}>
              {eventAirports.length > 1 && (
                <span className="font-medium">{airport}: </span>
              )}
              {rs.join(" · ")}
            </p>
          );
        })}
    </div>
  );
}

export default AirportChips;
