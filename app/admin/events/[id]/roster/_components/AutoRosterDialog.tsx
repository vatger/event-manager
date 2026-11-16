"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  analyzeFeasibility,
  DEFAULT_PLANNER_OPTIONS,
  planRoster,
  sortByPriority,
  type PlannerOptions,
} from "@/lib/roster/autoRoster";
import { toPlanningInput } from "@/lib/roster/autoRoster/input";
import { MAX_CONTINUOUS_MINUTES, formatDuration, minuteToDate } from "@/lib/roster/rosterTime";
import { FeasibilitySummary } from "../../_components/FeasibilitySummary";
import type {
  Assignment,
  RosterController,
  RosterStation,
  StationMeta,
} from "../_lib/rosterTypes";

type Mode = "fill" | "replace";

interface AutoRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  eventStart: Date;
  totalMinutes: number;
  slotMinutes: number;
  eventAirports: string[];
  stations: RosterStation[];
  stationMetaFor: (callsign: string) => StationMeta;
  controllers: RosterController[];
  assignments: Assignment[];
  apiHeaders: Record<string, string>;
  /** Plan übernommen – neu laden und ggf. Rückgängig-Eintrag anlegen */
  onApplied: (result: { createdIds: number[]; mode: Mode }) => void;
  /** Der Plan hat sich zwischenzeitlich geändert – neu laden */
  onConflict: () => void;
}

const BREAK_OPTIONS = [15, 30, 45, 60];

/**
 * Auto-Roster: erstellt aus den Anmeldungen einen Besetzungsplan und schreibt
 * ihn direkt als normale Schichten in den Plan – danach geht es von Hand
 * weiter. Oben steht vorab, ob der Plan mit den Anmeldungen überhaupt aufgeht.
 */
export function AutoRosterDialog({
  open,
  onOpenChange,
  eventId,
  eventStart,
  totalMinutes,
  slotMinutes,
  eventAirports,
  stations,
  stationMetaFor,
  controllers,
  assignments,
  apiHeaders,
  onApplied,
  onConflict,
}: AutoRosterDialogProps) {
  const [mode, setMode] = useState<Mode>("fill");
  const [minShift, setMinShift] = useState(DEFAULT_PLANNER_OPTIONS.minShift);
  const [maxShift, setMaxShift] = useState(DEFAULT_PLANNER_OPTIONS.maxShift);
  const [minBreak, setMinBreak] = useState(DEFAULT_PLANNER_OPTIONS.minBreak);
  const [respectPreferences, setRespectPreferences] = useState(true);
  const [excludedStations, setExcludedStations] = useState<Set<number>>(new Set());
  const [snapshot, setSnapshot] = useState(true);
  const [running, setRunning] = useState(false);

  const shiftLengths = useMemo(() => {
    const list: number[] = [];
    for (let m = slotMinutes; m <= 240; m += slotMinutes) list.push(m);
    return list;
  }, [slotMinutes]);

  const shiftCount = assignments.filter((a) => a.type === "controller").length;
  const blockCount = assignments.length;

  const input = useMemo(
    () =>
      toPlanningInput({
        stations,
        stationMetaFor,
        controllers,
        blocks: assignments,
        mode,
        eventAirports,
        totalMinutes,
        slotMinutes,
      }),
    [
      stations,
      stationMetaFor,
      controllers,
      assignments,
      mode,
      eventAirports,
      totalMinutes,
      slotMinutes,
    ]
  );
  const options: PlannerOptions = useMemo(
    () => ({
      ...DEFAULT_PLANNER_OPTIONS,
      minShift: Math.min(minShift, maxShift),
      maxShift,
      minBreak,
      respectPreferences,
      excludedStationIds: [...excludedStations],
      seed: eventId,
    }),
    [minShift, maxShift, minBreak, respectPreferences, excludedStations, eventId]
  );
  const report = useMemo(
    () => (open ? analyzeFeasibility(input, options) : null),
    [open, input, options]
  );

  // Stationen in der Reihenfolge, in der sie besetzt werden
  const stationsByPriority = useMemo(
    () => sortByPriority(input.stations),
    [input.stations]
  );

  const toggleStation = (id: number, include: boolean) => {
    setExcludedStations((prev) => {
      const next = new Set(prev);
      if (include) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = async () => {
    setRunning(true);
    try {
      // Einen Frame Luft, damit der Ladezustand sichtbar wird
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = planRoster(input, options);
      if (result.assignments.length === 0) {
        toast.info("Keine weiteren Schichten möglich – es ist niemand Passendes mehr frei.");
        return;
      }

      const res = await fetch(`/api/events/${eventId}/roster/auto`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          mode,
          snapshot: blockCount > 0 && snapshot,
          wishConflicts: result.wishConflicts,
          assignments: result.assignments.map((a) => ({
            stationId: a.stationId,
            userCID: a.userCID,
            startTime: minuteToDate(eventStart, a.start).toISOString(),
            endTime: minuteToDate(eventStart, a.end).toISOString(),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error(
          `${data.error ?? "Konflikt"} – der Plan wurde zwischenzeitlich geändert. Bitte erneut ausführen.`
        );
        onConflict();
        return;
      }
      if (!res.ok) throw new Error(data.error || "Übernahme fehlgeschlagen");

      const createdIds = (data.created as { id: number }[]).map((c) => c.id);
      const openMinutes = result.uncovered.reduce((sum, r) => sum + r.end - r.start, 0);
      onApplied({ createdIds, mode });
      toast.success(
        [
          createdIds.length === 1 ? "1 Schicht eingeplant" : `${createdIds.length} Schichten eingeplant`,
          openMinutes > 0 ? `${formatDuration(openMinutes)} Stationszeit offen` : "alles besetzt",
          result.wishConflicts.length > 0
            ? `${result.wishConflicts.length}× Wunsch nicht erfüllbar (orange markiert)`
            : null,
          data.snapshotId ? "Zwischenstand gesichert" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-Roster fehlgeschlagen");
    } finally {
      setRunning(false);
    }
  };

  const plannedStations = stations.length - excludedStations.size;

  const modes = [
    { value: "fill", title: "Lücken füllen", text: "Bestehende Schichten bleiben." },
    {
      value: "replace",
      title: "Neu planen",
      text: "Ersetzt alle Controller-Schichten, Custom- und persönliche Blöcke bleiben.",
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Auto-Roster
            <span className="rounded bg-accent-100 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent-800 dark:bg-accent-900/50 dark:text-accent-200">
              Beta
            </span>
          </DialogTitle>
          <DialogDescription>
            Plant die Anmeldungen von CTR abwärts ein. Die Schichten landen direkt im Plan.
          </DialogDescription>
        </DialogHeader>

        {report && <FeasibilitySummary report={report} eventStart={eventStart} />}

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="grid grid-cols-2 rounded-md border p-1" role="radiogroup">
              {modes.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === m.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.title}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {modes.find((m) => m.value === mode)?.text}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Schicht mindestens</Label>
              <Select value={String(minShift)} onValueChange={(v) => setMinShift(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shiftLengths
                    .filter((m) => m <= Math.min(120, maxShift))
                    .map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {formatDuration(m)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Höchstens am Stück</Label>
              <Select value={String(maxShift)} onValueChange={(v) => setMaxShift(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shiftLengths
                    .filter((m) => m >= Math.max(60, minShift))
                    .map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {formatDuration(m)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pause danach</Label>
              <Select value={String(minBreak)} onValueChange={(v) => setMinBreak(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREAK_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {formatDuration(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {maxShift > MAX_CONTINUOUS_MINUTES && (
            <p className="text-sm text-warning-900 dark:text-warning-200">
              Über {formatDuration(MAX_CONTINUOUS_MINUTES)} am Stück markiert der Editor als Hinweis.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={respectPreferences}
              onCheckedChange={(v) => setRespectPreferences(v === true)}
            />
            Wunschstationen berücksichtigen
          </label>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Stationen</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {plannedStations}/{stations.length}
              </span>
            </div>
            <div className="grid max-h-48 gap-x-4 overflow-y-auto rounded-md border px-3 py-2 sm:grid-cols-2">
              {stationsByPriority.map((st) => {
                const included = !excludedStations.has(st.id);
                const candidates = report?.candidatesByStation[st.id];
                return (
                  <label key={st.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox
                      checked={included}
                      onCheckedChange={(v) => toggleStation(st.id, v === true)}
                    />
                    <span className="font-mono">{st.callsign}</span>
                    {included && candidates !== undefined && (
                      <span
                        className={cn(
                          "ml-auto tabular-nums",
                          candidates === 0
                            ? "text-danger-700 dark:text-danger-300"
                            : "text-muted-foreground"
                        )}
                        title="Geeignete, verfügbare Anmeldungen"
                      >
                        {candidates}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {blockCount > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {mode === "replace"
                  ? `${shiftCount} ${shiftCount === 1 ? "Schicht wird" : "Schichten werden"} ersetzt.`
                  : `${blockCount} ${blockCount === 1 ? "bestehender Block bleibt" : "bestehende Blöcke bleiben"}.`}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={snapshot} onCheckedChange={(v) => setSnapshot(v === true)} />
                Vorher Zwischenstand sichern
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Abbrechen
          </Button>
          <Button onClick={run} disabled={running || plannedStations === 0}>
            {running && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "replace" ? "Neu planen" : "Lücken füllen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
