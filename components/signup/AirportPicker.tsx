"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { EndorsementResponse } from "@/lib/endorsements/types";

export type AirportEndorsements = Record<
  string,
  { canStaff: boolean; endorsement: EndorsementResponse | null }
>;

/**
 * Flughäfen und Freigaben als Kacheln.
 *
 * Bei mehreren Flughäfen lässt sich je Kachel wählen, ob man dort eingeplant
 * werden möchte; ohne Freigabe ist sie ausgegraut. Bei einem Flughafen steht
 * nur die Freigabe da. `canExclude` sperrt das Abwählen (Lotsen nach dem
 * Anmeldeschluss).
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
    <div className={cn("grid gap-2", multi && "sm:grid-cols-2")}>
      {airports.map((airport) => {
        const data = endorsements[airport];
        const canStaff = data?.canStaff ?? false;
        const endorsement = data?.endorsement;
        const selected = canStaff && !excluded.includes(airport);
        const locked = selected && !canExclude(airport);
        const interactive = multi && canStaff && !locked;
        const restrictions = endorsement?.restrictions ?? [];

        return (
          <button
            key={airport}
            type="button"
            disabled={!interactive}
            onClick={() => onToggle(airport)}
            aria-pressed={multi && canStaff ? selected : undefined}
            title={locked ? "Nach dem Anmeldeschluss nicht mehr abwählbar" : undefined}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
              selected
                ? "border-success-300 bg-success-50 dark:border-success-800 dark:bg-success-900/30"
                : canStaff
                ? "border-dashed bg-card hover:bg-muted"
                : "border-dashed bg-muted/40 text-muted-foreground",
              interactive && selected && "hover:bg-success-100 dark:hover:bg-success-900/50"
            )}
          >
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-wide">{airport}</span>
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
              </span>
              {!canStaff ? (
                <span className="block text-sm">Keine Freigabe</span>
              ) : (
                restrictions.length > 0 && (
                  <span className="block text-sm text-muted-foreground">
                    {restrictions.join(" · ")}
                  </span>
                )
              )}
            </span>
            {multi && canStaff && (
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  selected
                    ? "border-success-800 bg-success-800 text-white dark:border-success-500 dark:bg-success-600"
                    : "border-secondary-300 bg-card"
                )}
                aria-hidden
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default AirportPicker;
