"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ROSTER_FLAGS,
  ROSTER_FLAG_DOT,
  ROSTER_FLAG_HINT,
  ROSTER_FLAG_LABEL,
  type RosterFlag,
} from "@/lib/roster/rosterFlags";

interface FlagPickerProps {
  flag: RosterFlag | null;
  onChange: (flag: RosterFlag | null) => void;
  /** Größere Fassung mit Beschriftung – für die Seitenleiste */
  withLabel?: boolean;
  className?: string;
}

/**
 * Ampel-Markierung setzen. Bewusst ein winziger Punkt: In der Zeile soll er
 * nicht mit den Anmeldedaten konkurrieren, aber jederzeit erreichbar sein.
 */
export function FlagPicker({ flag, onChange, withLabel = false, className }: FlagPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={
            flag
              ? `Markierung: ${ROSTER_FLAG_LABEL[flag]} – ${ROSTER_FLAG_HINT[flag]}`
              : "Markierung setzen"
          }
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 flex items-center gap-1.5 rounded-full transition-colors",
            withLabel
              ? "border px-2 py-1 text-xs hover:bg-accent"
              : "h-4 w-4 justify-center hover:bg-accent",
            className
          )}
        >
          <span
            className={cn(
              "rounded-full",
              withLabel ? "h-2.5 w-2.5" : "h-2.5 w-2.5",
              flag ? ROSTER_FLAG_DOT[flag] : "border border-dashed border-muted-foreground/60"
            )}
          />
          {withLabel && <span>{flag ? ROSTER_FLAG_LABEL[flag] : "Keine Markierung"}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Interne Markierung
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ROSTER_FLAGS.map((f) => (
          <DropdownMenuItem key={f} onClick={() => onChange(f)} className="gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", ROSTER_FLAG_DOT[f])} />
            <span className="flex-1">{ROSTER_FLAG_LABEL[f]}</span>
            <span className="text-[10px] text-muted-foreground">{ROSTER_FLAG_HINT[f]}</span>
          </DropdownMenuItem>
        ))}
        {flag && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(null)} className="gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/60" />
              Markierung entfernen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FlagPicker;
