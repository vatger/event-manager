"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { Button } from "@/components/ui/button";
import { Ban, CalendarX2, Clock, Plus, Search, Star } from "lucide-react";
import type { RosterController, RosterStation, StationMeta, Assignment } from "../_lib/rosterTypes";
import {
  formatDuration,
  getControllerGroupForStation,
  minuteToHM,
  suggestControllers,
} from "../_lib/rosterUtils";

/** Häufige Custom-Block-Vorlagen */
const CUSTOM_PRESETS = ["Combined", "Training", "Sweatbox", "Mentoring", "Pause"];

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: RosterStation | null;
  stationMeta: StationMeta | null;
  start: number;
  end: number;
  eventStart: Date;
  eventAirports: string[];
  controllers: RosterController[];
  assignments: Assignment[];
  onAssign: (cid: number) => void;
  onCustom: (label: string) => void;
}

/**
 * Dialog zur Besetzung eines Zeitraums: zeigt alle Controller, die die
 * Station besetzen dürfen – sortiert nach frei/verfügbar/Wunschstation
 * und bereits eingeplanter Zeit.
 */
export function AssignDialog({
  open,
  onOpenChange,
  station,
  stationMeta,
  start,
  end,
  eventStart,
  eventAirports,
  controllers,
  assignments,
  onAssign,
  onCustom,
}: AssignDialogProps) {
  const [search, setSearch] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  const suggestions = useMemo(() => {
    if (!station || !stationMeta) return [];
    return suggestControllers(
      controllers,
      assignments,
      station,
      stationMeta,
      eventAirports,
      start,
      end
    );
  }, [station, stationMeta, controllers, assignments, eventAirports, start, end]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter(
      (s) =>
        s.controller.name.toLowerCase().includes(q) ||
        String(s.controller.cid).includes(q)
    );
  }, [suggestions, search]);

  if (!station || !stationMeta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {station.callsign}
            <Badge variant="outline" className="font-normal">
              {minuteToHM(eventStart, start)}z – {minuteToHM(eventStart, end)}z
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Verfügbare Controller mit passender Freigabe ({formatDuration(end - start)})
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Input
            placeholder="Name oder CID suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            autoFocus
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1 -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Kein Controller darf diese Station besetzen.
            </p>
          ) : (
            filtered.map((s) => {
              const group = getControllerGroupForStation(
                s.controller.entry,
                stationMeta.airport,
                eventAirports
              );
              const blocked = !s.free;
              return (
                <button
                  key={s.controller.cid}
                  disabled={blocked}
                  onClick={() => onAssign(s.controller.cid)}
                  className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                    blocked
                      ? "opacity-50 cursor-not-allowed bg-muted/40"
                      : "hover:bg-muted cursor-pointer"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        {s.controller.name}
                      </span>
                      {s.prefersStation && (
                        <span title="Wunsch-Station des Controllers">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>
                        {s.controller.cid} • {s.controller.rating}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(s.assignedMinutes)} eingeplant
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {blocked && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Ban className="h-3 w-3" /> belegt
                      </Badge>
                    )}
                    {!s.available && (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 text-amber-600 border-amber-300"
                        title="Laut Anmeldung in diesem Zeitraum nicht verfügbar"
                      >
                        <CalendarX2 className="h-3 w-3" /> abwesend
                      </Badge>
                    )}
                    <Badge className={getBadgeClassForEndorsement(group ?? undefined)}>
                      {group ?? "?"}
                    </Badge>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Custom-Block statt Controller eintragen */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Oder benutzerdefinierten Block eintragen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOM_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onCustom(preset);
                  setCustomLabel("");
                }}
              >
                {preset}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="z. B. Combined (MGN)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customLabel.trim()) {
                  onCustom(customLabel.trim());
                  setCustomLabel("");
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (customLabel.trim()) {
                  onCustom(customLabel.trim());
                  setCustomLabel("");
                }
              }}
              disabled={!customLabel.trim()}
            >
              <Plus className="h-4 w-4 mr-1" /> Eintragen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
