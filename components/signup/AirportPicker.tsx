"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { EndorsementResponse } from "@/lib/endorsements/types";

export type AirportEndorsements = Record<
  string,
  { canStaff: boolean; endorsement: EndorsementResponse | null }
>;

/**
 * Flughäfen und Freigaben – eine Liste, eine Zeile je Flughafen.
 *
 * Bei mehreren Flughäfen lässt sich je Zeile wählen, ob man dort eingeplant
 * werden möchte; ohne Freigabe ist die Zeile ausgegraut. Bei einem Flughafen
 * steht nur die Freigabe da. `canExclude` sperrt das Abwählen (Lotsen nach
 * dem Anmeldeschluss).
 */
export function AirportPicker({
  airports,
  endorsements,
  loading,
  excluded,
  onToggle,
  canExclude = () => true,
}: {
  airports: string[];
  endorsements: AirportEndorsements;
  loading: boolean;
  excluded: string[];
  onToggle: (airport: string) => void;
  canExclude?: (airport: string) => boolean;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Freigaben werden geprüft …
      </p>
    );
  }

  const multi = airports.length > 1;

  return (
    <ul className="divide-y rounded-md border">
      {airports.map((airport) => {
        const data = endorsements[airport];
        const canStaff = data?.canStaff ?? false;
        const endorsement = data?.endorsement;
        const selected = canStaff && !excluded.includes(airport);
        const locked = selected && !canExclude(airport);
        const restrictions = endorsement?.restrictions ?? [];
        const id = `airport-${airport}`;

        return (
          <li
            key={airport}
            className={cn("flex items-start gap-3 px-3 py-2.5", !canStaff && "text-muted-foreground")}
          >
            {multi && (
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={selected}
                disabled={!canStaff || locked}
                onCheckedChange={() => onToggle(airport)}
                aria-label={`${airport} ${selected ? "abwählen" : "auswählen"}`}
              />
            )}
            <label htmlFor={multi ? id : undefined} className="min-w-0 flex-1 cursor-pointer">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{airport}</span>
                {canStaff && endorsement?.group && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-semibold",
                      getBadgeClassForEndorsement(endorsement.group)
                    )}
                  >
                    {endorsement.group}
                  </span>
                )}
                {!canStaff && <span className="text-sm">keine Freigabe</span>}
              </span>
              {canStaff && restrictions.length > 0 && (
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {restrictions.join(" · ")}
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export default AirportPicker;
