"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarX2,
  Clock,
  Loader2,
  MessageSquare,
  Pencil,
  Plane,
  Search,
  Send,
  Star,
  StickyNote,
  UserRound,
  X,
} from "lucide-react";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { cn } from "@/lib/utils";
import {
  ROSTER_FLAG_DOT,
  ROSTER_FLAG_LABEL,
  ROSTER_FLAG_SOFT,
  type RosterFlag,
} from "@/lib/roster/rosterFlags";
import type { RosterController } from "../_lib/rosterTypes";
import { formatDuration, minuteToHM } from "../_lib/rosterUtils";
import { AirportChips } from "./AirportChips";
import { FlagPicker } from "./FlagPicker";

interface AtcStation {
  station: string;
  totalMinutes: number;
  sessionCount: number;
  lastSession?: string;
}

interface InternalComment {
  id: number;
  comment: string;
  authorName: string | null;
  createdAt: string;
}

interface ControllerInfoResponse {
  comments: InternalComment[];
  atcStations: AtcStation[];
  /** Summe über alle Stationen – für die Kopfzeile */
  atcTotalMinutes: number;
  statsError: boolean;
}

interface ControllerSidePanelProps {
  eventId: number;
  controller: RosterController | null;
  bestGroup: string | null;
  assignedMinutes: number;
  shiftLabels: string[];
  eventStart: Date;
  /** Airports des Events – bei mehreren zählt die Freigabe je Airport */
  eventAirports: string[];
  note: string;
  /** Interne Ampel-Markierung des ausgewählten Controllers */
  flag: RosterFlag | null;
  canEdit: boolean;
  canManageSignups: boolean;
  onClose: () => void;
  onSaveNote: (note: string) => Promise<boolean>;
  onSetFlag: (flag: RosterFlag | null) => void;
  onEditSignup: () => void;
  apiHeaders: Record<string, string>;
}

/** So viele Positionen werden ohne Suche direkt gezeigt */
const STATION_PREVIEW = 8;

function formatHours(minutes: number): string {
  const h = minutes / 60;
  if (h >= 10) return `${Math.round(h)}h`;
  return `${h.toFixed(1)}h`;
}

/**
 * Immer sichtbare rechte Seitenleiste des Roster-Editors.
 * Zeigt zum ausgewählten Controller: Anmeldedaten (Wunschstation, Remarks,
 * Verfügbarkeit), die interne Planungsnotiz (editierbar), persistente interne
 * RMKs und ATC-Statistiken. Bietet außerdem den Schnellzugriff zum Bearbeiten
 * der Anmeldung.
 */
export function ControllerSidePanel({
  eventId,
  controller,
  bestGroup,
  assignedMinutes,
  shiftLabels,
  eventStart,
  eventAirports,
  note,
  flag,
  canEdit,
  canManageSignups,
  onClose,
  onSaveNote,
  onSetFlag,
  onEditSignup,
  apiHeaders,
}: ControllerSidePanelProps) {
  const [draftNote, setDraftNote] = useState(note);
  const [savingNote, setSavingNote] = useState(false);
  const [info, setInfo] = useState<ControllerInfoResponse | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [stationQuery, setStationQuery] = useState("");
  const [showAllStations, setShowAllStations] = useState(false);

  const cid = controller?.cid ?? null;

  useEffect(() => {
    setDraftNote(note);
  }, [note, cid]);

  // Controller-Info (Stats + interne RMKs) bei Auswahl laden
  useEffect(() => {
    if (cid == null) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoadingInfo(true);
    setInfo(null);
    setStationQuery("");
    setShowAllStations(false);
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/roster/controller/${cid}`);
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as ControllerInfoResponse;
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled)
          setInfo({ comments: [], atcStations: [], atcTotalMinutes: 0, statsError: true });
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, eventId]);

  const saveNote = async () => {
    setSavingNote(true);
    const ok = await onSaveNote(draftNote.trim());
    setSavingNote(false);
    if (ok) toast.success(draftNote.trim() ? "Notiz gespeichert" : "Notiz entfernt");
  };

  const postComment = async () => {
    if (cid == null || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster/controller/${cid}`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ comment: newComment.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Fehler beim Speichern");
      }
      const j = await res.json();
      setInfo((prev) =>
        prev ? { ...prev, comments: [j.comment, ...prev.comments] } : prev
      );
      setNewComment("");
      toast.success("Interne RMK gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setPostingComment(false);
    }
  };

  // Stationsliste nach Suchbegriff filtern; ohne Suche nur die Top-Einträge
  const matchingStations = useMemo(() => {
    const all = info?.atcStations ?? [];
    const q = stationQuery.trim().toUpperCase();
    if (!q) return all;
    return all.filter((s) => s.station.toUpperCase().includes(q));
  }, [info, stationQuery]);

  const visibleStations = useMemo(
    () =>
      stationQuery.trim() || showAllStations
        ? matchingStations
        : matchingStations.slice(0, STATION_PREVIEW),
    [matchingStations, stationQuery, showAllStations]
  );

  const availabilityText = useMemo(() => {
    if (!controller) return null;
    if (!controller.hasAvailability) return "Keine Angabe (ganzes Event)";
    if (controller.unavailable.length === 0) return "Ganzes Event verfügbar";
    return null;
  }, [controller]);

  if (!controller) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
        <UserRound className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Kein Controller ausgewählt</p>
        <p className="text-xs mt-1">
          Klicke links auf einen Controller, um Anmeldedaten, interne Notizen und
          Statistiken zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Kopf */}
      <div className="p-3 border-b flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm truncate">{controller.name}</h3>
            <Badge className={`${getBadgeClassForEndorsement(bestGroup)} text-[10px] shrink-0`}>
              {bestGroup ?? "?"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {controller.cid} • {controller.rating}
            {assignedMinutes > 0 ? ` • ${formatDuration(assignedMinutes)} geplant` : " • frei"}
          </p>
          {/* Gesamte ATC-Erfahrung direkt im Kopf – wichtigste Kennzahl beim Planen */}
          {info && !info.statsError && info.atcTotalMinutes > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium">
              <BarChart3 className="h-3.5 w-3.5 text-accent-500" />
              <span>{formatHours(info.atcTotalMinutes)}</span>
              <span className="font-normal text-muted-foreground">ATC gesamt</span>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
          aria-label="Seitenleiste schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {/* Aktuelle Schichten */}
          {shiftLabels.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Geplante Schichten
              </p>
              <div className="flex flex-wrap gap-1">
                {shiftLabels.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px]">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Anmeldedaten */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Anmeldedaten</p>
              {canManageSignups && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={onEditSignup}
                >
                  <Pencil className="h-3 w-3 mr-1" /> Bearbeiten
                </Button>
              )}
            </div>

            <div className="rounded-lg border p-2.5 space-y-2 text-sm">
              {/* Bei mehreren Airports steht ganz oben, wo diese Person
                  überhaupt eingesetzt werden darf. */}
              {eventAirports.length > 1 && (
                <div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                    <Plane className="h-3 w-3" /> Freigaben je Airport
                  </span>
                  <AirportChips
                    entry={controller.entry}
                    eventAirports={eventAirports}
                    size="md"
                  />
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" /> Wunschstationen
                </span>
                <p className="text-sm break-words">
                  {controller.preferredStations || <span className="text-muted-foreground">–</span>}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-sky-500" /> Remarks
                </span>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {controller.remarks || <span className="text-muted-foreground">–</span>}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarX2 className="h-3 w-3" /> Verfügbarkeit
                </span>
                {availabilityText ? (
                  <p className="text-sm">{availabilityText}</p>
                ) : (
                  <ul className="text-sm space-y-0.5 mt-0.5">
                    {controller.unavailable.map((r, i) => (
                      <li key={i} className="text-red-600 dark:text-red-400 text-xs">
                        nicht verf.: {minuteToHM(eventStart, r.start)}z–{minuteToHM(eventStart, r.end)}z
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Interne Planungsnotiz + Ampel-Markierung (pro Roster) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 text-amber-500" /> Notiz für diese Planung
              </p>
              {canEdit ? (
                <FlagPicker flag={flag} onChange={onSetFlag} withLabel />
              ) : (
                flag && (
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs",
                      ROSTER_FLAG_SOFT[flag]
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full", ROSTER_FLAG_DOT[flag])} />
                    {ROSTER_FLAG_LABEL[flag]}
                  </span>
                )
              )}
            </div>
            {canEdit ? (
              <>
                <Textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="z. B. „nach 20z lieber APP“, „Schicht ggf. tauschen“…"
                  className="min-h-16 text-sm"
                  maxLength={2000}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={saveNote}
                    disabled={savingNote || draftNote.trim() === note.trim()}
                  >
                    {savingNote && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Notiz speichern
                  </Button>
                </div>
              </>
            ) : note ? (
              <p className="text-sm whitespace-pre-wrap rounded-lg border p-2">{note}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Notiz.</p>
            )}
          </div>

          <Separator />

          {/* Interne RMKs (persistente UserComments) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Interne RMKs
              {info && info.comments.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {info.comments.length}
                </Badge>
              )}
            </p>
            {loadingInfo && !info ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade…
              </div>
            ) : info && info.comments.length > 0 ? (
              <div className="space-y-1.5">
                {info.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border p-2 text-sm">
                    <p className="whitespace-pre-wrap break-words">{c.comment}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {c.authorName ?? "—"} •{" "}
                      {new Date(c.createdAt).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Keine internen RMKs vorhanden.</p>
            )}
            {canEdit && (
              <div className="flex gap-1.5">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Interne RMK hinzufügen…"
                  className="min-h-9 text-sm py-1.5"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={postComment}
                  disabled={postingComment || !newComment.trim()}
                  aria-label="RMK speichern"
                >
                  {postingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* ATC-Statistiken */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> ATC-Erfahrung (Top-Stationen)
            </p>
            {loadingInfo && !info ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Statistiken…
              </div>
            ) : info?.statsError ? (
              <p className="text-xs text-muted-foreground">Statistiken nicht verfügbar.</p>
            ) : info && info.atcStations.length > 0 ? (
              <>
                {/* Positionssuche: bei erfahrenen Controllern sind es schnell
                    dutzende Stationen – gezielt nachschlagen statt scrollen. */}
                <div className="relative">
                  <Input
                    value={stationQuery}
                    onChange={(e) => setStationQuery(e.target.value)}
                    placeholder="Position suchen, z. B. EDDF oder TWR…"
                    className="h-7 pl-7 text-xs"
                  />
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                {visibleStations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Keine Position passt zu „{stationQuery}“.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {visibleStations.map((s) => (
                      <div
                        key={s.station}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate font-mono text-xs">{s.station}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatHours(s.totalMinutes)} • {s.sessionCount}×
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {matchingStations.length > STATION_PREVIEW && !stationQuery && (
                  <button
                    onClick={() => setShowAllStations((v) => !v)}
                    className="text-xs text-accent-500 hover:underline"
                  >
                    {showAllStations
                      ? "Weniger anzeigen"
                      : `Alle ${matchingStations.length} Positionen anzeigen`}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Keine ATC-Sessions gefunden.</p>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
