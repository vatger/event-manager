"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Wand2 } from "lucide-react";
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
  ControllerMark,
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
  markByCid: Map<number, ControllerMark>;
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
  markByCid,
  apiHeaders,
  onApplied,
  onConflict,
}: AutoRosterDialogProps) {
  const [mode, setMode] = useState<Mode>("fill");
  const [minShift, setMinShift] = useState(DEFAULT_PLANNER_OPTIONS.minShift);
  const [maxShift, setMaxShift] = useState(DEFAULT_PLANNER_OPTIONS.maxShift);
  const [minBreak, setMinBreak] = useState(DEFAULT_PLANNER_OPTIONS.minBreak);
  const [respectPreferences, setRespectPreferences] = useState(true);
  const [skipRed, setSkipRed] = useState(true);
  const [excludedStations, setExcludedStations] = useState<Set<number>>(new Set());
  const [snapshot, setSnapshot] = useState(true);
  const [running, setRunning] = useState(false);

  const shiftLengths = useMemo(() => {
    const list: number[] = [];
    for (let m = slotMinutes; m <= 240; m += slotMinutes) list.push(m);
    return list;
  }, [slotMinutes]);

  const redCids = useMemo(
    () => [...markByCid].filter(([, m]) => m.flag === "red").map(([cid]) => cid),
    [markByCid]
  );
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
        excludedCids: skipRed ? redCids : [],
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
      skipRed,
      redCids,
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

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" /> Auto-Roster
          </DialogTitle>
          <DialogDescription>
            Erstellt aus den Anmeldungen einen Besetzungsplan – von oben nach unten (CTR vor APP
            vor TWR …), unter Beachtung von Freigaben, Verfügbarkeit und Pausen. Die Schichten
            landen direkt im Plan und lassen sich danach wie gewohnt bearbeiten.
          </DialogDescription>
        </DialogHeader>

        {report && <FeasibilitySummary report={report} eventStart={eventStart} />}

        <div className="space-y-4">
          {/* Modus */}
          <div className="space-y-1.5">
            <Label>Was soll geplant werden?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "fill",
                    title: "Lücken füllen",
                    text: "Bestehende Schichten bleiben, nur freie Zeiten werden besetzt.",
                  },
                  {
                    value: "replace",
                    title: "Neu planen",
                    text: "Ersetzt alle Controller-Schichten. Custom- und persönliche Blöcke bleiben.",
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    mode === m.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.text}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Schichtlängen */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Der Editor weist Schichten über {formatDuration(MAX_CONTINUOUS_MINUTES)} am Stück
              als Hinweis aus.
            </p>
          )}

          {/* Personen */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={respectPreferences}
                onCheckedChange={(v) => setRespectPreferences(v === true)}
              />
              Wunschstationen aus der Anmeldung bevorzugen
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={skipRed} onCheckedChange={(v) => setSkipRed(v === true)} />
              Rot markierte Personen nicht einplanen
              {redCids.length > 0 && (
                <span className="text-xs text-muted-foreground">({redCids.length})</span>
              )}
            </label>
          </div>

          {/* Stationen */}
          <div className="space-y-1.5">
            <Label>
              Stationen ({plannedStations} von {stations.length})
            </Label>
            <p className="text-xs text-muted-foreground">
              In Planungsreihenfolge. In Klammern: geeignete, verfügbare Anmeldungen.
            </p>
            <div className="grid gap-1 sm:grid-cols-2 max-h-48 overflow-y-auto rounded-lg border p-2">
              {stationsByPriority.map((st) => {
                const included = !excludedStations.has(st.id);
                const candidates = report?.candidatesByStation[st.id];
                return (
                  <label key={st.id} className="flex items-center gap-2 text-sm py-0.5">
                    <Checkbox
                      checked={included}
                      onCheckedChange={(v) => toggleStation(st.id, v === true)}
                    />
                    <span className="font-mono">{st.callsign}</span>
                    {included && candidates !== undefined && (
                      <span
                        className={cn(
                          "text-xs",
                          candidates === 0
                            ? "text-danger-700 dark:text-danger-300"
                            : "text-muted-foreground"
                        )}
                      >
                        ({candidates})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bestehender Plan */}
          {blockCount > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-1.5">
              <p className="text-sm">
                {mode === "replace"
                  ? shiftCount === 1
                    ? "Der Plan enthält 1 Controller-Schicht – sie wird ersetzt."
                    : `Der Plan enthält ${shiftCount} Controller-Schichten – sie werden ersetzt.`
                  : blockCount === 1
                  ? "Der Plan enthält bereits 1 Block – er bleibt unverändert."
                  : `Der Plan enthält bereits ${blockCount} Blöcke – sie bleiben unverändert.`}
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={snapshot} onCheckedChange={(v) => setSnapshot(v === true)} />
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                Vorher Snapshot anlegen
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Abbrechen
          </Button>
          <Button onClick={run} disabled={running || plannedStations === 0}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4 mr-1.5" />
            )}
            {mode === "replace" ? "Plan neu erstellen" : "Lücken füllen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
