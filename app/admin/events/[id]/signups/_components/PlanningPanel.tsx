"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Loader2,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignupChange, SignupTableEntry } from "@/lib/cache/types";
import {
  buildPlanningAlerts,
  fieldLabel,
  planningSummary,
  type AlertAssignmentInput,
  type AlertStationInput,
  type PlanningAlert,
  type PlanningSeverity,
} from "@/lib/roster/planningAlerts";
import { formatDuration, minuteToHM } from "@/lib/roster/rosterTime";
import {
  ROSTER_FLAG_DOT,
  ROSTER_FLAG_LABEL,
  type RosterFlag,
} from "@/lib/roster/rosterFlags";
import { getSolidClassForStationGroup } from "@/utils/EndorsementBadge";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";

interface PlanningPanelProps {
  eventId: number;
  signups: SignupTableEntry[];
  eventStart: Date;
  totalMinutes: number;
  assignments: AlertAssignmentInput[];
  stations: AlertStationInput[];
  /** Interne Ampel-Markierungen aus der Roster-Planung */
  flagByCid: Map<number, RosterFlag>;
  /** Existiert überhaupt ein Besetzungsplan? */
  hasRoster: boolean;
  canOpenRoster: boolean;
  canAcknowledge: boolean;
  /** Nach dem Quittieren neu laden */
  onChanged: () => void;
}

const SEVERITY_STYLE: Record<PlanningSeverity, string> = {
  danger: "border-danger-600/40 bg-danger-600/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-border bg-muted/30",
};

const SEVERITY_ICON: Record<PlanningSeverity, typeof TriangleAlert> = {
  danger: TriangleAlert,
  warning: BellRing,
  info: ClipboardList,
};

const SEVERITY_TEXT: Record<PlanningSeverity, string> = {
  danger: "text-danger-700 dark:text-danger-300",
  warning: "text-amber-700 dark:text-amber-300",
  info: "text-muted-foreground",
};

/** Wert aus dem Änderungsprotokoll lesbar machen */
function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "availability" && typeof value === "object") {
    const av = value as { unavailable?: { start: string; end: string }[] };
    const list = av.unavailable ?? [];
    if (list.length === 0) return "durchgehend verfügbar";
    return list.map((r) => `${r.start}–${r.end} nicht verf.`).join(", ");
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ChangeRow({ change }: { change: SignupChange }) {
  return (
    <li className="text-xs leading-snug">
      <span className="font-medium">{fieldLabel(change.field)}:</span>{" "}
      <span className="text-muted-foreground line-through">
        {formatValue(change.field, change.oldValue)}
      </span>{" "}
      <ArrowRight className="inline h-3 w-3 mx-0.5 mb-0.5" />{" "}
      <span>{formatValue(change.field, change.newValue)}</span>
      <span className="text-muted-foreground ml-1.5">
        (
        {new Date(change.changedAt).toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
        )
      </span>
    </li>
  );
}

/**
 * Planungsbereich der Anmeldungsseite.
 *
 * Beantwortet die zwei Fragen, die beim Planen zwischen Anmeldeliste und
 * Besetzungsplan stehen: Wie weit ist der Plan – und was hat sich seit dem
 * letzten Blick geändert? Jede Änderung wird direkt mit den betroffenen
 * Schichten gezeigt, damit ihre Tragweite ohne Wechsel in den Editor
 * erkennbar ist.
 */
export function PlanningPanel({
  eventId,
  signups,
  eventStart,
  totalMinutes,
  assignments,
  stations,
  flagByCid,
  hasRoster,
  canOpenRoster,
  canAcknowledge,
  onChanged,
}: PlanningPanelProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showInfo, setShowInfo] = useState(false);
  const [acking, setAcking] = useState<number | null>(null);

  const input = useMemo(
    () => ({ signups, assignments, stations, eventStart, totalMinutes }),
    [signups, assignments, stations, eventStart, totalMinutes]
  );

  const alerts = useMemo(() => buildPlanningAlerts(input), [input]);
  const summary = useMemo(() => planningSummary(input, alerts), [input, alerts]);

  const visibleAlerts = useMemo(
    () => (showInfo ? alerts : alerts.filter((a) => a.severity !== "info")),
    [alerts, showInfo]
  );
  const infoCount = alerts.length - alerts.filter((a) => a.severity !== "info").length;

  const acknowledge = useCallback(
    async (alert: PlanningAlert) => {
      setAcking(alert.signupId);
      try {
        const res = await fetch(`/api/events/${eventId}/signup/${alert.cid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acknowledgeChanges: true }),
        });
        if (!res.ok) throw new Error("Quittieren fehlgeschlagen");
        toast.success(`Änderung von ${alert.name} als gesehen markiert`);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Quittieren fehlgeschlagen");
      } finally {
        setAcking(null);
      }
    },
    [eventId, onChanged]
  );

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Planung
          </span>
          {canOpenRoster && (
            <Button asChild size="sm" variant={hasRoster ? "outline" : "default"}>
              <Link href={`/admin/events/${eventId}/roster`}>
                {hasRoster ? "Besetzungsplan öffnen" : "Besetzungsplan anlegen"}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Planungsstand */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold leading-none">{summary.activeSignups}</p>
            <p className="text-xs text-muted-foreground mt-1">aktive Anmeldungen</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold leading-none text-emerald-600 dark:text-emerald-400">
              {summary.scheduled}
            </p>
            <p className="text-xs text-muted-foreground mt-1">davon eingeplant</p>
          </div>
          <div className="rounded-lg border p-3">
            <p
              className={cn(
                "text-2xl font-semibold leading-none",
                summary.unscheduled > 0 ? "text-amber-600 dark:text-amber-400" : ""
              )}
            >
              {summary.unscheduled}
            </p>
            <p className="text-xs text-muted-foreground mt-1">noch ohne Schicht</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-semibold leading-none">
              {hasRoster ? formatDuration(summary.plannedMinutes) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">verplante Zeit</p>
          </div>
        </div>

        {!hasRoster && (
          <p className="text-sm text-muted-foreground">
            Für dieses Event gibt es noch keinen Besetzungsplan. Sobald er angelegt ist,
            zeigt dieser Bereich, wen Änderungen an der Anmeldung im Plan betreffen.
          </p>
        )}

        {/* Änderungen seit dem Anmeldeschluss */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              Nachträgliche Änderungen
              {summary.openAlerts > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500/50">
                  {summary.openAlerts} offen
                </Badge>
              )}
            </p>
            {infoCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowInfo((v) => !v)}
              >
                {showInfo ? "Nur Wichtiges" : `${infoCount} weitere anzeigen`}
              </Button>
            )}
          </div>

          {visibleAlerts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              Keine offenen Änderungen – die Anmeldungen entsprechen dem Planungsstand.
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleAlerts.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity];
                const isOpen = expanded.has(alert.signupId);
                const flag = flagByCid.get(alert.cid);
                return (
                  <li
                    key={`${alert.kind}-${alert.signupId}`}
                    className={cn("rounded-lg border px-3 py-2.5", SEVERITY_STYLE[alert.severity])}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon
                        className={cn("h-4 w-4 mt-0.5 shrink-0", SEVERITY_TEXT[alert.severity])}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          {flag && (
                            <span
                              className={cn(
                                "inline-block h-2 w-2 rounded-full mr-1.5 mb-0.5",
                                ROSTER_FLAG_DOT[flag]
                              )}
                              title={`Interne Markierung: ${ROSTER_FLAG_LABEL[flag]}`}
                            />
                          )}
                          <span className="font-medium">{alert.name}</span>{" "}
                          <span className="text-muted-foreground">({alert.cid})</span>{" "}
                          {alert.headline}
                        </p>

                        {/* Betroffene Schichten – das macht die Tragweite sichtbar */}
                        {alert.shifts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {alert.shifts.map((s, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                                  getSolidClassForStationGroup(extractStationGroup(s.callsign)),
                                  s.conflict && "ring-2 ring-danger-600 ring-offset-1 ring-offset-background"
                                )}
                                title={
                                  s.conflict
                                    ? "Diese Schicht liegt in einer als nicht verfügbar gemeldeten Zeit"
                                    : undefined
                                }
                              >
                                {s.callsign}
                                <span className="font-normal opacity-90">
                                  {minuteToHM(eventStart, s.start)}–{minuteToHM(eventStart, s.end)}
                                </span>
                                {s.conflict && <TriangleAlert className="h-2.5 w-2.5" />}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Was genau geändert wurde */}
                        {alert.changes.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggle(alert.signupId)}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform",
                                  isOpen && "rotate-180"
                                )}
                              />
                              {alert.changes.length} Änderung
                              {alert.changes.length === 1 ? "" : "en"} anzeigen
                            </button>
                            {isOpen && (
                              <ul className="mt-1.5 space-y-1 border-l-2 pl-2.5">
                                {alert.changes.map((c, i) => (
                                  <ChangeRow key={i} change={c} />
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {alert.kind === "withdrawn_scheduled" && (
                          <Badge variant="outline" className="gap-1 text-[10px] border-danger-600/50">
                            <UserX className="h-3 w-3" /> im Plan
                          </Badge>
                        )}
                        {alert.canAcknowledge && canAcknowledge && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={acking === alert.signupId}
                            onClick={() => acknowledge(alert)}
                          >
                            {acking === alert.signupId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1">Gesehen</span>
                          </Button>
                        )}
                        {canOpenRoster && alert.shifts.length > 0 && (
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                            <Link href={`/admin/events/${eventId}/roster`}>
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              Im Plan
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PlanningPanel;
