"use client";

import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { SignupTableEntry } from "@/lib/cache/types";
import type { StationGroup } from "@/lib/weeklys/stationUtils";

interface AirportChipsProps {
  entry: SignupTableEntry;
  eventAirports: string[];
  /** Kompakte Fassung für enge Zeilen */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Freigaben je Airport auf einen Blick.
 *
 * Bei Events über mehrere Airports ist „S3" keine brauchbare Auskunft mehr –
 * dieselbe Person darf an einem Airport Approach und am nächsten nur Ground,
 * und manche Airports hat sie bei der Anmeldung ganz abgewählt. Diese drei
 * Fälle stehen hier nebeneinander, damit beim Besetzen niemand raten muss.
 */
export function AirportChips({
  entry,
  eventAirports,
  size = "sm",
  className,
}: AirportChipsProps) {
  if (eventAirports.length < 2) return null;

  const excluded = Array.isArray(entry.excludedAirports) ? entry.excludedAirports : [];
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {eventAirports.map((airport) => {
        const isExcluded = excluded.includes(airport);
        const group = (entry.airportEndorsements?.[airport]?.group ?? null) as
          | StationGroup
          | null;

        // Drei Zustände: abgewählt, keine Freigabe, Freigabe bis Gruppe X
        const title = isExcluded
          ? `${airport}: bei der Anmeldung abgewählt`
          : group
          ? `${airport}: Freigabe bis ${group}`
          : `${airport}: keine Freigabe`;

        return (
          <span
            key={airport}
            title={title}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 leading-none",
              text,
              isExcluded
                ? "bg-muted text-muted-foreground line-through decoration-danger-600/70"
                : group
                ? getBadgeClassForEndorsement(group)
                : "bg-muted text-muted-foreground"
            )}
          >
            {airport}
            {!isExcluded && <span className="font-semibold">{group ?? "–"}</span>}
          </span>
        );
      })}
    </div>
  );
}

export default AirportChips;
