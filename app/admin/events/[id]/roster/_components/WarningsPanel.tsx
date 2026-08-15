"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleSlash,
  Coffee,
  Layers,
  RotateCcw,
  UserX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterWarning, WarningType } from "../_lib/rosterTypes";
import { warningKey } from "../_lib/rosterUtils";

interface WarningsPanelProps {
  /** Sichtbare Hinweise (ohne die ausgeblendeten) */
  warnings: RosterWarning[];
  /** Ausgeblendete Hinweise, die aktuell noch zutreffen */
  dismissed: RosterWarning[];
  canEdit: boolean;
  onSelect: (assignmentId: number) => void;
  onDismiss: (key: string, dismissed: boolean) => void;
  onClose: () => void;
}

/** Reihenfolge nach Dringlichkeit – oben steht, was den Plan wirklich bricht */
const TYPE_ORDER: WarningType[] = [
  "overlap",
  "withdrawn",
  "airport_excluded",
  "not_eligible",
  "unavailable",
  "no_break_switch",
  "long_stretch",
];

const TYPE_LABEL: Record<WarningType, string> = {
  overlap: "Doppelbelegung",
  withdrawn: "Abgemeldet",
  airport_excluded: "Airport abgewählt",
  not_eligible: "Freigabe fehlt",
  unavailable: "Nicht verfügbar",
  no_break_switch: "Wechsel ohne Pause",
  long_stretch: "Lange Schicht",
};

const TYPE_ICON: Record<WarningType, typeof AlertTriangle> = {
  overlap: Layers,
  withdrawn: UserX,
  airport_excluded: CircleSlash,
  not_eligible: AlertTriangle,
  unavailable: AlertTriangle,
  no_break_switch: AlertTriangle,
  long_stretch: Coffee,
};

/** Blockierendes Problem oder Hinweis zur Abwägung? */
const HARD_TYPES = new Set<WarningType>(["overlap", "withdrawn", "airport_excluded"]);

/**
 * Planungshinweise.
 *
 * Sortiert nach Dringlichkeit und nach Art gruppiert, weil eine flache Liste
 * bei großen Events schnell zwanzig Zeilen lang wird und dann niemand mehr
 * unterscheidet, was den Plan bricht und was nur zur Abwägung steht. Geprüfte
 * Hinweise lassen sich einzeln ausblenden – und ebenso einzeln zurückholen.
 */
export function WarningsPanel({
  warnings,
  dismissed,
  canEdit,
  onSelect,
  onDismiss,
  onClose,
}: WarningsPanelProps) {
  const [filter, setFilter] = useState<WarningType | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<WarningType, number>();
    for (const w of warnings) map.set(w.type, (map.get(w.type) ?? 0) + 1);
    return map;
  }, [warnings]);

  const visible = useMemo(() => {
    const list = filter ? warnings.filter((w) => w.type === filter) : warnings;
    return [...list].sort(
      (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
    );
  }, [warnings, filter]);

  const hardCount = warnings.filter((w) => HARD_TYPES.has(w.type)).length;

  const row = (w: RosterWarning, isDismissed: boolean) => {
    const key = warningKey(w);
    const Icon = TYPE_ICON[w.type];
    return (
      <li
        key={key}
        className={cn(
          "group/warn flex items-start gap-2 rounded px-1.5 py-1 hover:bg-background/60",
          isDismissed && "opacity-60"
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 mt-0.5 shrink-0",
            HARD_TYPES.has(w.type) ? "text-danger-600" : "text-amber-600"
          )}
        />
        <button
          className="text-left text-sm leading-snug hover:underline min-w-0 flex-1"
          onClick={() => w.assignmentIds[0] != null && onSelect(w.assignmentIds[0])}
        >
          {w.message}
        </button>
        {canEdit && (
          <button
            onClick={() => onDismiss(key, !isDismissed)}
            className={cn(
              "shrink-0 rounded p-0.5 text-muted-foreground transition-opacity hover:text-foreground",
              isDismissed
                ? "opacity-100"
                : "opacity-0 group-hover/warn:opacity-100 focus:opacity-100"
            )}
            title={isDismissed ? "Wieder einblenden" : "Geprüft – ausblenden"}
            aria-label={isDismissed ? "Hinweis wieder einblenden" : "Hinweis ausblenden"}
          >
            {isDismissed ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-300/60 dark:border-amber-800/60">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-medium">
          Planungshinweise
          {hardCount > 0 && (
            <span className="ml-1.5 text-danger-700 dark:text-danger-300">
              · {hardCount} kritisch
            </span>
          )}
        </span>

        {/* Filter je Art – bei großen Plänen der schnellste Weg zum Thema */}
        <div className="flex items-center gap-1 flex-wrap ml-1">
          {TYPE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => (
            <button
              key={t}
              onClick={() => setFilter((f) => (f === t ? null : t))}
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[10px] leading-none transition-colors",
                filter === t
                  ? "border-foreground/40 bg-background"
                  : "border-transparent text-muted-foreground hover:bg-background/60"
              )}
              title={`Nur „${TYPE_LABEL[t]}" zeigen`}
            >
              {TYPE_LABEL[t]} {counts.get(t)}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Hinweise ausblenden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-2 py-1.5 max-h-40 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-1.5 py-1 text-sm text-muted-foreground">
            {warnings.length === 0
              ? "Keine offenen Hinweise."
              : "Keine Hinweise dieser Art."}
          </p>
        ) : (
          <ul className="space-y-0.5">{visible.map((w) => row(w, false))}</ul>
        )}
      </div>

      {dismissed.length > 0 && (
        <div className="border-t border-amber-300/60 dark:border-amber-800/60">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start rounded-none px-3 text-xs text-muted-foreground"
            onClick={() => setShowDismissed((v) => !v)}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 mr-1 transition-transform", showDismissed && "rotate-180")}
            />
            {dismissed.length} als geprüft ausgeblendet
          </Button>
          {showDismissed && (
            <ul className="space-y-0.5 px-2 pb-1.5 max-h-32 overflow-y-auto">
              {dismissed.map((w) => row(w, true))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default WarningsPanel;
