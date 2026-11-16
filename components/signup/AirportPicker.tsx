"use client";

import { Check, Loader2, Lock, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import type { EndorsementResponse } from "@/lib/endorsements/types";

export type AirportEndorsements = Record<
  string,
  { canStaff: boolean; endorsement: EndorsementResponse | null }
>;

/**
 * Flughäfen und Freigaben im Anmeldedialog.
 *
 * Bei einem Flughafen nur die Freigabe zur Info. Bei mehreren lässt sich je
 * Flughafen wählen, ob man dort eingeplant werden möchte; ohne Freigabe ist
 * der Flughafen ausgegraut. Nach dem Anmeldeschluss (`locked`) lassen sich
 * Flughäfen nur noch hinzunehmen.
 */
export function AirportPicker({
  airports,
  endorsements,
  loading,
  excluded,
  onToggle,
  canExclude,
}: {
  airports: string[];
  endorsements: AirportEndorsements;
  loading: boolean;
  excluded: string[];
  onToggle: (airport: string) => void;
  /** Darf der Flughafen (wieder) abgewählt werden? */
  canExclude: (airport: string) => boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Freigaben werden geprüft …
      </div>
    );
  }

  const multi = airports.length > 1;

  return (
    <div className={cn("grid gap-2", multi && "sm:grid-cols-2")}>
      {airports.map((airport) => {
        const data = endorsements[airport];
        const canStaff = data?.canStaff ?? false;
        const endorsement = data?.endorsement;
        const isExcluded = excluded.includes(airport);
        const selected = canStaff && !isExcluded;
        const fixed = multi && selected && !canExclude(airport);
        const interactive = multi && canStaff && !fixed;

        const state = !canStaff ? "none" : selected ? "selected" : "excluded";
        const Icon = state === "selected" ? (fixed ? Lock : Check) : state === "excluded" ? X : Minus;

        return (
          <button
            key={airport}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onToggle(airport)}
            aria-pressed={multi && canStaff ? selected : undefined}
            title={
              fixed
                ? "Nach dem Anmeldeschluss kannst du Flughäfen nur noch hinzufügen"
                : !canStaff
                ? "Für diesen Flughafen hast du keine Freigabe"
                : undefined
            }
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
              state === "selected" &&
                "border-success-300 bg-success-50 dark:border-success-800 dark:bg-success-900/20",
              state === "selected" && interactive && "hover:bg-success-100 dark:hover:bg-success-900/30",
              state === "excluded" &&
                "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30",
              state === "none" && "border-dashed bg-muted/40 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                state === "selected" && "bg-success-600 text-white",
                state === "excluded" && "bg-amber-500 text-white",
                state === "none" && "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold tracking-wide">{airport}</span>
                {endorsement?.group && (
                  <Badge className={cn("text-[10px]", getBadgeClassForEndorsement(endorsement.group))}>
                    {endorsement.group}
                  </Badge>
                )}
                {multi && (
                  <span className="ml-auto text-xs font-medium">
                    {state === "selected" ? "Dabei" : state === "excluded" ? "Nicht eingeplant" : "Keine Freigabe"}
                  </span>
                )}
              </span>
              {!canStaff && endorsement?.blockReason && (
                <span className="block text-xs">{endorsement.blockReason}</span>
              )}
              {!multi && canStaff && (endorsement?.restrictions.length ?? 0) === 0 && (
                <span className="block text-xs text-muted-foreground">
                  Laut Trainingsdaten darfst du bis {endorsement?.group} besetzen.
                </span>
              )}
              {canStaff && (endorsement?.restrictions.length ?? 0) > 0 && (
                <span className="block space-y-0.5 text-xs text-muted-foreground">
                  {endorsement!.restrictions.map((r, i) => (
                    <span key={i} className="block">
                      • {r}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default AirportPicker;
