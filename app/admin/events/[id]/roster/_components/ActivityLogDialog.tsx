"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeftRight,
  ArrowRightLeft,
  Eye,
  FileText,
  Flag,
  Loader2,
  MoveHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  StickyNote,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityEntry {
  id: number;
  action: string;
  summary: string;
  stationCallsign: string | null;
  targetCID: number | null;
  actorCID: number | null;
  actorName: string | null;
  createdAt: string;
}

interface ActivityLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
}

/** Symbol je Art der Änderung – erspart das Lesen, wenn man nur sucht */
const ACTION_ICON: Record<string, typeof Plus> = {
  assignment_created: Plus,
  assignment_moved: MoveHorizontal,
  assignment_resized: ArrowLeftRight,
  assignment_reassigned: UserCog,
  assignment_recolored: Settings2,
  assignment_deleted: Trash2,
  assignment_swapped: ArrowRightLeft,
  stations_changed: Settings2,
  slot_changed: Settings2,
  roster_published: Eye,
  roster_reset: RotateCcw,
  snapshot_restored: RotateCcw,
  editor_added: Users,
  editor_removed: Users,
  note_changed: StickyNote,
  flag_changed: Flag,
  briefing_changed: FileText,
};

/** Grobe Einteilung für den Filter */
const ACTION_GROUP: Record<string, string> = {
  assignment_created: "Besetzung",
  assignment_moved: "Besetzung",
  assignment_resized: "Besetzung",
  assignment_reassigned: "Besetzung",
  assignment_recolored: "Besetzung",
  assignment_deleted: "Besetzung",
  assignment_swapped: "Besetzung",
  stations_changed: "Aufbau",
  slot_changed: "Aufbau",
  roster_published: "Veröffentlichung",
  roster_reset: "Aufbau",
  snapshot_restored: "Aufbau",
  editor_added: "Zugriff",
  editor_removed: "Zugriff",
  note_changed: "Notizen",
  flag_changed: "Notizen",
  briefing_changed: "Veröffentlichung",
};

/** Änderungen, die dicht beieinander liegen, gehören zu einem Arbeitsschritt */
const SESSION_GAP_MS = 10 * 60 * 1000;

function dayLabel(date: Date): string {
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = (startOfDay(today) - startOfDay(date)) / 86_400_000;
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function clock(date: Date): string {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface Session {
  key: string;
  actorName: string | null;
  actorCID: number | null;
  from: Date;
  to: Date;
  entries: ActivityEntry[];
}

/**
 * Änderungsprotokoll des Besetzungsplans.
 *
 * Eine reine Liste aus hundert Zeilen beantwortet die Frage „wer hat das
 * geändert?" nur mühsam. Deshalb wie im Versionsverlauf einer Tabelle: nach Tag
 * gegliedert, und innerhalb eines Tages fasst ein Block zusammen, was dieselbe
 * Person in einem Zug gemacht hat. Aufgeklappt steht jede Änderung einzeln da.
 */
export function ActivityLogDialog({ open, onOpenChange, eventId }: ActivityLogDialogProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actorFilter, setActorFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (before?: number) => {
      const more = before !== undefined;
      if (more) setLoadingMore(true);
      else setLoading(true);
      try {
        const url = `/api/events/${eventId}/roster/activity${more ? `?before=${before}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Verlauf konnte nicht geladen werden");
        const data = await res.json();
        const next = (data.entries ?? []) as ActivityEntry[];
        setEntries((prev) => (more ? [...prev, ...next] : next));
        setHasMore(Boolean(data.hasMore));
        setCursor(data.nextCursor ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verlauf konnte nicht geladen werden");
      } finally {
        if (more) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (!open) return;
    setEntries([]);
    setExpanded(new Set());
    void load();
  }, [open, load]);

  /** Wer hat überhaupt etwas geändert – Grundlage des Personenfilters */
  const actors = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of entries) {
      if (e.actorCID) map.set(e.actorCID, e.actorName ?? `CID ${e.actorCID}`);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (actorFilter !== "all" && String(e.actorCID) !== actorFilter) return false;
      if (groupFilter !== "all" && (ACTION_GROUP[e.action] ?? "Sonstiges") !== groupFilter) {
        return false;
      }
      if (q && !e.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, actorFilter, groupFilter, search]);

  /** Nach Tag, darin nach Arbeitsschritt derselben Person */
  const days = useMemo(() => {
    const out: { label: string; sessions: Session[] }[] = [];
    let currentDay: { label: string; sessions: Session[] } | null = null;
    let currentSession: Session | null = null;

    for (const entry of visible) {
      const at = new Date(entry.createdAt);
      const label = dayLabel(at);
      if (!currentDay || currentDay.label !== label) {
        currentDay = { label, sessions: [] };
        out.push(currentDay);
        currentSession = null;
      }
      const sameActor = currentSession?.actorCID === entry.actorCID;
      const closeInTime =
        currentSession && currentSession.from.getTime() - at.getTime() < SESSION_GAP_MS;
      if (currentSession && sameActor && closeInTime) {
        currentSession.entries.push(entry);
        currentSession.from = at;
      } else {
        currentSession = {
          key: `s-${entry.id}`,
          actorName: entry.actorName,
          actorCID: entry.actorCID,
          from: at,
          to: at,
          entries: [entry],
        };
        currentDay.sessions.push(currentSession);
      }
    }
    return out;
  }, [visible]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hasFilter = actorFilter !== "all" || groupFilter !== "all" || search.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Verlauf</DialogTitle>
          <DialogDescription>
            Wer hat wann was am Plan geändert.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Station, Name, Uhrzeit…"
              className="h-8 pl-7 text-xs"
            />
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger size="sm" className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Bearbeiter</SelectItem>
              {actors.map(([cid, name]) => (
                <SelectItem key={cid} value={String(cid)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger size="sm" className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Arten</SelectItem>
              {["Besetzung", "Aufbau", "Veröffentlichung", "Notizen", "Zugriff"].map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && (
            <div className="space-y-2 py-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {!loading && error && <p className="py-6 text-sm text-destructive">{error}</p>}

          {!loading && !error && visible.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {hasFilter
                ? "Keine Einträge zu dieser Auswahl."
                : "Noch keine Änderungen aufgezeichnet."}
            </p>
          )}

          {!loading &&
            days.map((day) => (
              <div key={day.label} className="mb-3">
                <p className="sticky top-0 z-10 bg-background/95 py-1 text-xs font-semibold text-muted-foreground backdrop-blur">
                  {day.label}
                </p>
                <div className="space-y-1.5">
                  {day.sessions.map((session) => {
                    const isOpen = expanded.has(session.key) || session.entries.length === 1;
                    const range =
                      clock(session.from) === clock(session.to)
                        ? clock(session.to)
                        : `${clock(session.from)}–${clock(session.to)}`;
                    return (
                      <div key={session.key} className="rounded-lg border">
                        <button
                          type="button"
                          onClick={() => session.entries.length > 1 && toggle(session.key)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-2.5 py-2 text-left",
                            session.entries.length > 1 && "hover:bg-muted/60"
                          )}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                            {initials(session.actorName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {session.actorName ?? "Unbekannt"}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {range} · {session.entries.length}{" "}
                              {session.entries.length === 1 ? "Änderung" : "Änderungen"}
                            </span>
                          </span>
                          {session.entries.length > 1 && (
                            <span className="text-[11px] text-muted-foreground">
                              {isOpen ? "zuklappen" : "aufklappen"}
                            </span>
                          )}
                        </button>

                        {isOpen && (
                          <ul className="border-t">
                            {session.entries.map((e) => {
                              const Icon = ACTION_ICON[e.action] ?? Settings2;
                              return (
                                <li
                                  key={e.id}
                                  className="flex items-start gap-2 px-2.5 py-1.5 text-xs border-b last:border-b-0"
                                >
                                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1">{e.summary}</span>
                                  <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                                    {clock(new Date(e.createdAt))}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {!loading && hasMore && (
            <div className="py-2 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => cursor !== null && load(cursor)}
              >
                {loadingMore && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Ältere Änderungen laden
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityLogDialog;
