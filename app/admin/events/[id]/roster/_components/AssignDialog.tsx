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
import {
  Ban,
  CalendarX2,
  Clock,
  CircleSlash,
  Plus,
  Search,
  Star,
  TriangleAlert,
  UserX,
} from "lucide-react";
import type {
  RosterController,
  RosterStation,
  StationMeta,
  Assignment,
  ControllerMark,
} from "../_lib/rosterTypes";
import { ROSTER_FLAG_DOT, ROSTER_FLAG_LABEL } from "@/lib/roster/rosterFlags";
import {
  CUSTOM_BLOCK_COLORS,
  CUSTOM_BLOCK_COLOR_DOT,
  CUSTOM_BLOCK_COLOR_LABEL,
  type CustomBlockColor,
} from "@/lib/roster/blockColors";
import { cn } from "@/lib/utils";
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
  /** Interne Notiz + Ampel-Markierung, damit die Auswahl sie berücksichtigt */
  markByCid: Map<number, ControllerMark>;
  onAssign: (cid: number) => void;
  onCustom: (label: string, color: CustomBlockColor | null) => void;
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
  markByCid,
  onAssign,
  onCustom,
}: AssignDialogProps) {
  const [search, setSearch] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customColor, setCustomColor] = useState<CustomBlockColor | null>(null);

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
        String(s.controller.cid).includes(q) ||
        s.controller.preferredStations.toLowerCase().includes(q) ||
        (s.controller.remarks ?? "").toLowerCase().includes(q)
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
            Controller für diesen Zeitraum ({formatDuration(end - start)}) – ohne
            passende Freigabe markiert
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
              Keine Anmeldungen gefunden.
            </p>
          ) : (
            filtered.map((s) => {
              const group = getControllerGroupForStation(
                s.controller.entry,
                stationMeta.airport,
                eventAirports
              );
              // Belegte Zeiten bleiben gesperrt; fehlende Freigabe und
              // zurückgezogene Anmeldung sind nur Warnungen.
              const blocked = !s.free;
              const mark = markByCid.get(s.controller.cid);
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
                      {mark?.flag && (
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${ROSTER_FLAG_DOT[mark.flag]}`}
                          title={`Interne Markierung: ${ROSTER_FLAG_LABEL[mark.flag]}`}
                        />
                      )}
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
                    {/* Wünsche, Remarks und interne Notiz direkt in der Auswahl –
                        so muss beim Besetzen niemand erst ein Profil öffnen. */}
                    {(s.controller.preferredStations || s.controller.remarks || mark?.note) && (
                      <div className="mt-0.5 space-y-0.5">
                        {s.controller.preferredStations && (
                          <p className="text-[11px] leading-tight text-amber-700 dark:text-amber-300 truncate">
                            Wunsch: {s.controller.preferredStations}
                          </p>
                        )}
                        {s.controller.remarks && (
                          <p
                            className="text-[11px] leading-tight text-foreground/70 line-clamp-2"
                            title={s.controller.remarks}
                          >
                            {s.controller.remarks}
                          </p>
                        )}
                        {mark?.note && (
                          <p
                            className="text-[11px] leading-tight text-sky-700 dark:text-sky-300 line-clamp-2"
                            title={mark.note}
                          >
                            Notiz: {mark.note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {blocked && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Ban className="h-3 w-3" /> belegt
                      </Badge>
                    )}
                    {/* Der Grund entscheidet, was zu tun ist: fehlende Freigabe
                        lässt sich klären, ein abgewählter Airport nicht. */}
                    {!s.eligibility.ok && s.eligibility.reason === "excluded_airport" && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-danger-300 text-[10px] text-danger-700"
                        title={`${s.eligibility.airport} wurde bei der Anmeldung abgewählt`}
                      >
                        <CircleSlash className="h-3 w-3" /> {s.eligibility.airport} abgewählt
                      </Badge>
                    )}
                    {!s.eligibility.ok && s.eligibility.reason === "no_endorsement" && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-danger-300 text-[10px] text-danger-700"
                        title={`Freigabe${
                          s.eligibility.airport ? ` an ${s.eligibility.airport}` : ""
                        }: ${s.eligibility.has ?? "keine"} – benötigt ${s.eligibility.needs}`}
                      >
                        <TriangleAlert className="h-3 w-3" />
                        {s.eligibility.has ?? "keine"} statt {s.eligibility.needs}
                      </Badge>
                    )}
                    {s.controller.withdrawn && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-danger-300 text-[10px] text-danger-700"
                        title="Anmeldung wurde zurückgezogen"
                      >
                        <UserX className="h-3 w-3" /> abgemeldet
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
                  onCustom(preset, customColor);
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
                  onCustom(customLabel.trim(), customColor);
                  setCustomLabel("");
                }
              }}
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (customLabel.trim()) {
                  onCustom(customLabel.trim(), customColor);
                  setCustomLabel("");
                }
              }}
              disabled={!customLabel.trim()}
            >
              <Plus className="h-4 w-4 mr-1" /> Eintragen
            </Button>
          </div>
          {/* Farbe des Blocks – hilft, eigene Systematik sichtbar zu machen
              (etwa alle Trainings in derselben Farbe). */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-xs text-muted-foreground mr-0.5">Farbe:</span>
            <button
              type="button"
              onClick={() => setCustomColor(null)}
              aria-label="Standardfarbe"
              title="Standard"
              className={cn(
                "h-5 w-5 rounded-full border border-dashed border-muted-foreground/60 transition-transform",
                customColor === null && "ring-2 ring-foreground/40 scale-110"
              )}
            />
            {CUSTOM_BLOCK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCustomColor(c)}
                aria-label={CUSTOM_BLOCK_COLOR_LABEL[c]}
                title={CUSTOM_BLOCK_COLOR_LABEL[c]}
                className={cn(
                  "h-5 w-5 rounded-full transition-transform",
                  CUSTOM_BLOCK_COLOR_DOT[c],
                  customColor === c && "ring-2 ring-foreground/40 scale-110"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
