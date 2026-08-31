"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Download,
  Copy,
  Eye,
  GripVertical,
  History,
  MessageSquare,
  MoreHorizontal,
  Palette,
  RotateCcw,
  Settings2,
  Star,
  StickyNote,
  Undo2,
  UserPlus,
  UserX,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { cn } from "@/lib/utils";
import { stationBlockColors } from "@/lib/roster/stationColors";
import { describeFamiliarizations } from "@/lib/stations/familiarizations";
import {
  CUSTOM_BLOCK_COLORS,
  CUSTOM_BLOCK_COLOR_DOT,
  CUSTOM_BLOCK_COLOR_LABEL,
  customBlockClass,
} from "@/lib/roster/blockColors";
import type { SignupTableEntry } from "@/lib/cache/types";
import { STATION_GROUP_ORDER } from "@/lib/weeklys/stationUtils";
import type { RosterPresenceUser } from "@/lib/roster/rosterEvents";
import type {
  ApiRoster,
  Assignment,
  ControllerMark,
  DragState,
  RosterController,
  RosterStation,
  RosterWarning,
  StationMeta,
  UndoEntry,
} from "../_lib/rosterTypes";
import { ROSTER_FLAGS, ROSTER_FLAG_BAR, type RosterFlag } from "@/lib/roster/rosterFlags";
import {
  assignedMinutesByController,
  buildControllers,
  computeWarnings,
  formatDuration,
  getControllerGroupForStation,
  checkEligibility,
  hasExcludedAirport,
  hasOverlap,
  isUnavailable,
  minutesBetween,
  minuteToDate,
  minuteToHM,
  resolveStationMeta,
  rosterToCsv,
  rosterToText,
  stationCoverage,
  stationOccupied,
  warningKey,
} from "../_lib/rosterUtils";
import { AirportChips } from "./AirportChips";
import { ControllerFilterBar, type ControllerSort } from "./ControllerFilterBar";
import { InfoColumnContextMenu, InfoColumnControls } from "./InfoColumnMenu";
import {
  DEFAULT_INFO_FIELDS,
  INFO_FIELDS,
  type InfoField,
} from "../_lib/infoFields";
import { WarningsPanel } from "./WarningsPanel";
import { AssignDialog } from "./AssignDialog";
import { FlagPicker } from "./FlagPicker";
import { PresenceBar } from "./PresenceBar";
import { RosterSettingsDialog } from "./RosterSettingsDialog";
import { ControllerSidePanel } from "./ControllerSidePanel";
import { SnapshotsDialog } from "./SnapshotsDialog";
import SignupEditDialog from "../../_components/SignupEditDialog";

// (ControllerInfoPopover wurde durch die immer sichtbare Seitenleiste ersetzt)

// Layout-Konstanten
const LABEL_W = 224; // Breite der linken Beschriftungsspalte
// Mit eingeblendeter Infospalte wandert der Zeitstrahl nach rechts: Die
// Beschriftungsspalte wird breiter, weil Stationen- und Controller-Board
// denselben Nullpunkt teilen müssen.
const INFO_W = 250; // Zusatzbreite für Wünsche/Remarks/Notiz
const ROW_H = 44; // Zeilenhöhe
const ROW_H_INFO = 62; // Zeilenhöhe im Controller-Board mit Infospalte
const ZOOM_LEVELS = [28, 40, 56, 76]; // Pixel pro Slot
const DEFAULT_DURATION = 60; // Standarddauer neuer Zuweisungen (Minuten)
const REMARKS_PREF_KEY = "roster:showRemarks";
const COLLAPSE_PREF_KEY = "roster:collapsedAirports";
const INFO_FIELDS_PREF_KEY = "roster:infoFields";
const SPLIT_PREF_KEY = "roster:stationsHeight";
const MIN_PANE = 120; // Mindesthöhe je Bereich
const UNDO_LIMIT = 40; // so viele Schritte lassen sich zurücknehmen

interface EditorEvent {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  airports: string[];
  firCode?: string;
  signupSlotMinutes?: number;
  status: string;
}

interface RosterEditorProps {
  event: EditorEvent;
  roster: ApiRoster;
  signups: SignupTableEntry[];
  stationMetaMap: Map<string, StationMeta>;
  canEdit: boolean;
  canManageEditors: boolean;
  canManageSignups: boolean;
  /** Weicht der Arbeitsstand von der veröffentlichten Fassung ab? */
  hasUnpublishedChanges: boolean;
  /** Nur das Roster neu laden (Realtime-Sync, Dialog-Updates) */
  onReload: () => void;
  /** Roster + Signups neu laden (nach Signup-Änderungen) */
  onReloadAll: () => void;
  onEventStatusChanged: (status: string) => void;
}

interface DragValidity {
  valid: boolean;
  warn: boolean;
  reason: string | null;
}

export function RosterEditor({
  event,
  roster,
  signups,
  stationMetaMap,
  canEdit,
  canManageEditors,
  canManageSignups,
  hasUnpublishedChanges,
  onReload,
  onReloadAll,
  onEventStatusChanged,
}: RosterEditorProps) {
  const router = useRouter();
  // Eigene CID: markiert die eigene Kachel in der Anwesenheitsanzeige
  const { data: session } = useSession();
  const selfCID = session?.user?.cid ? Number(session.user.cid) : null;
  const eventStart = useMemo(() => new Date(event.startTime), [event.startTime]);
  const eventEnd = useMemo(() => new Date(event.endTime), [event.endTime]);
  const totalMinutes = useMemo(
    () => Math.max(0, minutesBetween(eventStart, eventEnd)),
    [eventStart, eventEnd]
  );
  const slotMinutes = roster.slotMinutes;
  const slotCount = Math.max(1, Math.ceil(totalMinutes / slotMinutes));

  const [zoomIdx, setZoomIdx] = useState(1);
  const pxPerSlot = ZOOM_LEVELS[zoomIdx];
  const pxPerMinute = pxPerSlot / slotMinutes;
  const timelineWidth = slotCount * pxPerSlot;

  // Eindeutige Client-ID: eigene Realtime-Events werden damit ausgefiltert
  const clientId = useMemo(
    () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  // ------------------------------------------------------------------
  // Lokale (optimistische) Zuweisungen + Stationen
  // ------------------------------------------------------------------
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  useEffect(() => {
    setAssignments(
      roster.assignments.map((a) => ({
        id: a.id,
        stationId: a.stationId,
        type: a.type,
        userCID: a.userCID,
        label: a.label,
        color: a.color,
        start: minutesBetween(eventStart, new Date(a.startTime)),
        end: minutesBetween(eventStart, new Date(a.endTime)),
      }))
    );
  }, [roster.assignments, eventStart]);

  // Stationen als lokaler State (für optimistisches Umsortieren per DnD)
  const [stations, setStations] = useState(roster.stations);
  useEffect(() => {
    setStations(roster.stations);
  }, [roster.stations]);

  // Interne Notiz + Ampel-Markierung pro Controller
  const markByCid = useMemo(() => {
    const map = new Map<number, ControllerMark>();
    for (const n of roster.notes ?? []) {
      map.set(n.userCID, { note: n.note ?? "", flag: n.flag ?? null });
    }
    return map;
  }, [roster.notes]);
  const noteFor = useCallback(
    (cid: number) => markByCid.get(cid)?.note ?? "",
    [markByCid]
  );
  const flagFor = useCallback(
    (cid: number) => markByCid.get(cid)?.flag ?? null,
    [markByCid]
  );

  const stationById = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations]
  );
  const stationMetaFor = useCallback(
    (callsign: string): StationMeta => resolveStationMeta(callsign, stationMetaMap),
    [stationMetaMap]
  );

  /**
   * Zu welchem Airport gehört eine Station? Bei Events über mehrere Airports
   * ist das die wichtigste Gliederung – EDDF_TWR und EDDM_TWR nebeneinander zu
   * sehen hilft niemandem beim Planen.
   */
  const airportOf = useCallback(
    (callsign: string): string => stationMetaFor(callsign).airport ?? "Weitere",
    [stationMetaFor]
  );
  // Für die Drag-Logik, die außerhalb des Renderzyklus läuft
  const airportOfRef = useRef(airportOf);
  airportOfRef.current = airportOf;
  const groupByAirport = event.airports.length > 1;


  const controllers = useMemo(
    () => buildControllers(signups, eventStart, totalMinutes),
    [signups, eventStart, totalMinutes]
  );
  const controllerByCid = useMemo(
    () => new Map(controllers.map((c) => [c.cid, c])),
    [controllers]
  );

  // ------------------------------------------------------------------
  // UI-State
  // ------------------------------------------------------------------
  const [drag, setDrag] = useState<DragState | null>(null);
  // Auswahl als Menge: Mehrere Blöcke lassen sich mit Strg/Cmd sammeln und
  // gemeinsam verschieben oder löschen.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  /** Genau einen Block auswählen (z. B. Sprung aus der Hinweisliste) */
  const setSelectedId = useCallback((id: number | null) => {
    setSelectedIds(id === null ? new Set() : new Set([id]));
  }, []);
  const [assignDialog, setAssignDialog] = useState<{
    stationId: number;
    start: number;
    end: number;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [controllerSearch, setControllerSearch] = useState("");
  const [controllerSort, setControllerSort] = useState<ControllerSort>("group");
  // Infospalte: Wünsche, Remarks und interne Notiz aller Controller nebeneinander
  const [showRemarks, setShowRemarks] = useState(true);
  // Filter auf Ampel-Markierungen (leer = alle zeigen)
  const [flagFilter, setFlagFilter] = useState<Set<RosterFlag>>(new Set());
  // Nur Controller zeigen, die diese Station besetzen dürfen (null = alle)
  const [stationFilter, setStationFilter] = useState<number | null>(null);
  // Auf einen Airport eingrenzen; die Freigaben beziehen sich dann auf ihn
  const [airportFilter, setAirportFilter] = useState<string | null>(null);
  // Nur Controller ohne jede Zuweisung
  const [onlyUnscheduled, setOnlyUnscheduled] = useState(false);
  // Welche Angaben stehen in der Infospalte?
  const [infoFields, setInfoFields] = useState<Set<InfoField>>(
    new Set(DEFAULT_INFO_FIELDS)
  );
  // Rechtsklick-Menü in der Infospalte (Anker an der Mausposition)
  const [infoMenuAt, setInfoMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  // Wer den Plan gerade offen hat (aus dem SSE-Stream)
  const [presence, setPresence] = useState<RosterPresenceUser[]>([]);
  // Ausgewählter Controller für die Seitenleiste
  const [selectedCID, setSelectedCID] = useState<number | null>(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  // Signup bearbeiten/hinzufügen (null = zu, {signup:null} = neu anlegen)
  const [signupDialog, setSignupDialog] = useState<{ signup: SignupTableEntry | null } | null>(null);
  // Schnellnotiz direkt in der Infospalte (Doppelklick)
  const [noteDraftCID, setNoteDraftCID] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Die Wahl der Infospalte überdauert Seitenwechsel – wer mit Remarks plant,
  // will sie beim nächsten Öffnen wiederhaben.
  useEffect(() => {
    const stored = window.localStorage.getItem(REMARKS_PREF_KEY);
    if (stored !== null) setShowRemarks(stored === "1");
  }, []);
  useEffect(() => {
    window.localStorage.setItem(REMARKS_PREF_KEY, showRemarks ? "1" : "0");
  }, [showRemarks]);
  useEffect(() => {
    const stored = window.localStorage.getItem(INFO_FIELDS_PREF_KEY);
    if (!stored) return;
    try {
      const list = JSON.parse(stored) as string[];
      if (Array.isArray(list)) {
        setInfoFields(new Set(list.filter((f): f is InfoField =>
          (INFO_FIELDS as readonly string[]).includes(f)
        )));
      }
    } catch {
      // ungültiger Eintrag – Standard behalten
    }
  }, []);
  const toggleInfoField = useCallback((field: InfoField) => {
    setInfoFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      window.localStorage.setItem(INFO_FIELDS_PREF_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Getrennte Scrollbereiche: senkrecht unabhängig, waagerecht im Gleichschritt
  // ------------------------------------------------------------------
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const stationScrollRef = useRef<HTMLDivElement>(null);
  const controllerScrollRef = useRef<HTMLDivElement>(null);
  // Verhindert, dass das programmgesteuerte Setzen erneut ein Ereignis auslöst
  const syncingRef = useRef(false);

  const syncHorizontal = useCallback((source: "header" | "station" | "controller") => {
    if (syncingRef.current) return;
    const from =
      source === "header"
        ? headerScrollRef.current
        : source === "station"
        ? stationScrollRef.current
        : controllerScrollRef.current;
    if (!from) return;
    syncingRef.current = true;
    for (const [key, el] of [
      ["header", headerScrollRef.current],
      ["station", stationScrollRef.current],
      ["controller", controllerScrollRef.current],
    ] as const) {
      if (key !== source && el && el.scrollLeft !== from.scrollLeft) {
        el.scrollLeft = from.scrollLeft;
      }
    }
    // Erst im nächsten Frame freigeben, sonst laufen die ausgelösten
    // Scroll-Ereignisse noch in dieselbe Runde.
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  /** Höhe des Stationsbereichs; der Rest gehört den Controllern */
  const [stationsHeight, setStationsHeight] = useState(280);
  useEffect(() => {
    const stored = window.localStorage.getItem(SPLIT_PREF_KEY);
    const value = stored ? Number(stored) : NaN;
    if (!isNaN(value) && value >= MIN_PANE && value <= 1200) setStationsHeight(value);
  }, []);

  const startSplitDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = stationScrollRef.current?.getBoundingClientRect().height ?? 280;
    const container = stationScrollRef.current?.parentElement;
    const maxHeight = container
      ? Math.max(MIN_PANE, container.getBoundingClientRect().height - MIN_PANE - 90)
      : 900;

    const onMove = (ev: PointerEvent) => {
      const next = clamp(startHeight + (ev.clientY - startY), MIN_PANE, maxHeight);
      setStationsHeight(next);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const next = clamp(startHeight + (ev.clientY - startY), MIN_PANE, maxHeight);
      window.localStorage.setItem(SPLIT_PREF_KEY, String(Math.round(next)));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // Beide Boards teilen sich den Nullpunkt des Zeitstrahls, deshalb gilt die
  // Breite der Beschriftungsspalte auch für die Stationen.
  const labelWidth = showRemarks ? LABEL_W + INFO_W : LABEL_W;
  const controllerRowH = showRemarks ? ROW_H_INFO : ROW_H;

  /**
   * Ob es unveröffentlichte Änderungen gibt, weiß nur der Server. Da eigene
   * Änderungen bewusst kein vollständiges Neuladen auslösen (optimistischer
   * Stand), fragen wir nach jeder Mutation gebündelt nur diesen Stand ab –
   * sonst erschiene „Änderungen veröffentlichen" erst nach einem Seitenreload.
   */
  const [unpublished, setUnpublished] = useState(hasUnpublishedChanges);
  useEffect(() => setUnpublished(hasUnpublishedChanges), [hasUnpublishedChanges]);
  // ------------------------------------------------------------------
  // Rückgängig: Stapel mit den Gegenoperationen der letzten Änderungen
  // ------------------------------------------------------------------
  // Jede Mutation legt hier ab, wie sie sich zurücknehmen lässt. Der Stapel
  // liegt bewusst nur im Client: Er beschreibt die eigene Arbeitsspur, nicht
  // den gemeinsamen Zustand. Ändert jemand anders denselben Block, schlägt das
  // Rückgängigmachen sauber fehl, statt fremde Arbeit zu überschreiben.
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack((prev) => [...prev, entry].slice(-UNDO_LIMIT));
  }, []);

  // Aktueller Stand für Gegenoperationen, ohne die Mutationen bei jeder
  // Änderung neu zu erzeugen
  const assignmentsRef = useRef<Assignment[]>(assignments);
  assignmentsRef.current = assignments;

  const publishStateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPublishState = useCallback(() => {
    if (publishStateTimer.current) clearTimeout(publishStateTimer.current);
    publishStateTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/${event.id}/roster/status`);
        if (!res.ok) return;
        const data = await res.json();
        setUnpublished(Boolean(data.hasUnpublishedChanges));
      } catch {
        // Anzeigezustand – ein Fehlschlag darf die Bearbeitung nicht stören
      }
    }, 500);
  }, [event.id]);
  useEffect(
    () => () => {
      if (publishStateTimer.current) clearTimeout(publishStateTimer.current);
    },
    []
  );

  // ------------------------------------------------------------------
  // Realtime-Sync: SSE-Stream abonnieren, bei fremden Änderungen neu laden
  // ------------------------------------------------------------------
  const onReloadRef = useRef(onReload);
  onReloadRef.current = onReload;
  const onReloadAllRef = useRef(onReloadAll);
  onReloadAllRef.current = onReloadAll;

  useEffect(() => {
    const es = new EventSource(`/api/events/${event.id}/roster/stream`);
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    es.onopen = () => setLiveConnected(true);
    es.onerror = () => {
      setLiveConnected(false);
      setPresence([]);
    };
    es.addEventListener("change", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { sourceClientId: string | null };
        if (data.sourceClientId === clientId) return; // eigene Änderung
      } catch {
        // im Zweifel neu laden
      }
      // Mehrere schnelle Änderungen zu einem Reload bündeln
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => onReloadRef.current(), 250);
    });

    es.addEventListener("presence", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { users: RosterPresenceUser[] };
        setPresence(Array.isArray(data.users) ? data.users : []);
      } catch {
        // fehlerhafte Nachricht ignorieren
      }
    });

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      es.close();
    };
  }, [event.id, clientId]);

  // ------------------------------------------------------------------
  // API-Operationen (optimistisch, Rollback bei Fehler)
  // ------------------------------------------------------------------
  const tempIdRef = useRef(-1);

  const apiHeaders = useMemo(
    () => ({ "Content-Type": "application/json", "x-roster-client": clientId }),
    [clientId]
  );

  /** Controller-Zuweisung oder Custom-Block anlegen (optimistisch) */
  const createAssignment = useCallback(
    async (
      stationId: number,
      start: number,
      end: number,
      opts: { userCID?: number; label?: string; color?: string | null; track?: boolean }
    ) => {
      const isCustom = !!opts.label;
      const track = opts.track !== false;
      const tempId = tempIdRef.current--;
      const optimistic: Assignment = {
        id: tempId,
        stationId,
        type: isCustom ? "custom" : "controller",
        userCID: isCustom ? null : opts.userCID ?? null,
        label: isCustom ? opts.label ?? null : null,
        color: isCustom ? opts.color ?? null : null,
        start,
        end,
      };
      setAssignments((prev) => [...prev, optimistic]);
      try {
        const res = await fetch(`/api/events/${event.id}/roster/assignments`, {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            stationId,
            type: isCustom ? "custom" : "controller",
            userCID: isCustom ? undefined : opts.userCID,
            label: isCustom ? opts.label : undefined,
            color: isCustom ? opts.color ?? undefined : undefined,
            startTime: minuteToDate(eventStart, start).toISOString(),
            endTime: minuteToDate(eventStart, end).toISOString(),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Block fehlgeschlagen");
        }
        const j = await res.json();
        const realId = j.assignment.id as number;
        setAssignments((prev) => {
          // Falls ein Realtime-Reload den optimistischen Eintrag entfernt hat,
          // den gespeicherten Block wieder anhängen
          if (!prev.some((a) => a.id === tempId)) {
            if (prev.some((a) => a.id === realId)) return prev;
            return [...prev, { ...optimistic, id: realId }];
          }
          return prev.map((a) => (a.id === tempId ? { ...a, id: realId } : a));
        });
        if (track) pushUndo({ kind: "created", assignmentId: realId });
        refreshPublishState();
      } catch (err) {
        setAssignments((prev) => prev.filter((a) => a.id !== tempId));
        toast.error(err instanceof Error ? err.message : "Block fehlgeschlagen");
      }
    },
    [event.id, eventStart, apiHeaders, refreshPublishState, pushUndo]
  );

  const updateAssignment = useCallback(
    async (
      id: number,
      patch: Partial<Pick<Assignment, "stationId" | "userCID" | "start" | "end" | "color">>,
      track = true
    ) => {
      // Zustand vor der Änderung für Rollback und Rückgängig festhalten
      const before = assignmentsRef.current.find((a) => a.id === id);
      let previous: Assignment | undefined;
      setAssignments((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          previous = a;
          return { ...a, ...patch };
        })
      );
      try {
        const body: Record<string, unknown> = {};
        if (patch.stationId !== undefined) body.stationId = patch.stationId;
        if (patch.color !== undefined) body.color = patch.color;
        // userCID nur senden, wenn es ein echter Controller ist (Custom-Blöcke: null → weglassen)
        if (patch.userCID !== undefined && patch.userCID !== null) body.userCID = patch.userCID;
        if (patch.start !== undefined)
          body.startTime = minuteToDate(eventStart, patch.start).toISOString();
        if (patch.end !== undefined)
          body.endTime = minuteToDate(eventStart, patch.end).toISOString();
        const res = await fetch(`/api/events/${event.id}/roster/assignments/${id}`, {
          method: "PATCH",
          headers: apiHeaders,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Änderung fehlgeschlagen");
        }
        if (track && before) {
          pushUndo({
            kind: "updated",
            assignmentId: id,
            before: {
              stationId: before.stationId,
              start: before.start,
              end: before.end,
              color: before.color,
            },
          });
        }
        refreshPublishState();
      } catch (err) {
        if (previous) {
          const restore = previous;
          setAssignments((prev) => prev.map((a) => (a.id === id ? restore : a)));
        }
        toast.error(err instanceof Error ? err.message : "Änderung fehlgeschlagen");
      }
    },
    [event.id, eventStart, apiHeaders, refreshPublishState, pushUndo]
  );

  const deleteAssignment = useCallback(
    async (id: number, track = true) => {
      const removed = assignmentsRef.current.find((a) => a.id === id);
      const previous = assignments;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (id < 0) return; // rein optimistische (noch nicht gespeicherte) Zuweisung
      try {
        const res = await fetch(`/api/events/${event.id}/roster/assignments/${id}`, {
          method: "DELETE",
          headers: apiHeaders,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Löschen fehlgeschlagen");
        }
        if (track && removed) pushUndo({ kind: "deleted", snapshot: removed });
        refreshPublishState();
      } catch (err) {
        setAssignments(previous);
        toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      }
    },
    [assignments, event.id, apiHeaders, refreshPublishState, pushUndo]
  );

  /**
   * Letzte Änderung zurücknehmen. Die Gegenoperation läuft über dieselben
   * API-Pfade wie jede andere Änderung – sie wird nur selbst nicht wieder
   * auf den Stapel gelegt.
   */
  const undoLast = useCallback(async () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry || undoing) return;
    setUndoStack((prev) => prev.slice(0, -1));
    setUndoing(true);
    try {
      if (entry.kind === "created") {
        await deleteAssignment(entry.assignmentId, false);
        toast.success("Block entfernt");
      } else if (entry.kind === "deleted") {
        const a = entry.snapshot;
        await createAssignment(a.stationId, a.start, a.end, {
          userCID: a.userCID ?? undefined,
          label: a.label ?? undefined,
          color: a.color,
          track: false,
        });
        toast.success("Block wiederhergestellt");
      } else {
        await updateAssignment(entry.assignmentId, entry.before, false);
        toast.success("Änderung zurückgenommen");
      }
    } finally {
      setUndoing(false);
    }
  }, [undoStack, undoing, createAssignment, updateAssignment, deleteAssignment]);

  /**
   * Interne Notiz und/oder Ampel-Markierung speichern. Nicht übergebene Felder
   * lässt der Server unverändert; sind am Ende beide leer, verschwindet der
   * Eintrag.
   */
  const saveMark = useCallback(
    async (
      userCID: number,
      patch: { note?: string; flag?: RosterFlag | null }
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/events/${event.id}/roster/notes`, {
          method: "PUT",
          headers: apiHeaders,
          body: JSON.stringify({ userCID, ...patch }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Speichern fehlgeschlagen");
        }
        onReloadRef.current();
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
        return false;
      }
    },
    [event.id, apiHeaders]
  );

  /** Schnellnotiz übernehmen (nur speichern, wenn sich etwas geändert hat) */
  const commitNoteDraft = useCallback(() => {
    const cid = noteDraftCID;
    if (cid === null) return;
    setNoteDraftCID(null);
    const before = markByCid.get(cid)?.note ?? "";
    if (noteDraft.trim() === before.trim()) return;
    void saveMark(cid, { note: noteDraft });
  }, [noteDraftCID, noteDraft, markByCid, saveMark]);

  /** Stationsreihenfolge speichern (nach DnD-Umsortierung) */
  const persistStationOrder = useCallback(
    async (ordered: typeof stations) => {
      try {
        const res = await fetch(`/api/events/${event.id}/roster`, {
          method: "PATCH",
          headers: apiHeaders,
          body: JSON.stringify({ stations: ordered.map((s) => s.callsign) }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Reihenfolge speichern fehlgeschlagen");
        }
      } catch (err) {
        setStations(roster.stations);
        toast.error(err instanceof Error ? err.message : "Reihenfolge speichern fehlgeschlagen");
      }
    },
    [event.id, apiHeaders, roster.stations]
  );

  // Entf-Taste löscht die ausgewählte Zuweisung
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!canEdit) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        e.preventDefault();
        for (const id of selectedIds) deleteAssignment(id);
        setSelectedIds(new Set());
      }
      if (e.key === "Escape") setSelectedIds(new Set());
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        e.preventDefault();
        void undoLast();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, deleteAssignment, canEdit, undoLast]);

  // ------------------------------------------------------------------
  // Drag & Drop Engine (Pointer Events)
  // ------------------------------------------------------------------
  // Timeline-Zeilen registrieren sich hier für das Hit-Testing
  const rowRefs = useRef(
    new Map<string, { el: HTMLDivElement; kind: "station" | "controller"; id: number }>()
  );
  const registerRow = useCallback(
    (kind: "station" | "controller", id: number) => (el: HTMLDivElement | null) => {
      const key = `${kind}-${id}`;
      if (el) rowRefs.current.set(key, { el, kind, id });
      else rowRefs.current.delete(key);
    },
    []
  );

  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      for (const { el, kind, id } of rowRefs.current.values()) {
        // Eine Zeile zählt nur, solange der Zeiger in ihrem eigenen
        // Scrollbereich steht. Ohne diese Schranke gewinnen Stationszeilen,
        // die aus ihrem Bereich herausgescrollt sind: Ihr Rechteck liegt dann
        // rechnerisch über dem Controller-Bereich, obwohl sie dort gar nicht
        // zu sehen sind. Beim Verschieben eines Blocks in der Zeitachse sprang
        // er dadurch auf eine fremde Station.
        const pane =
          kind === "station" ? stationScrollRef.current : controllerScrollRef.current;
        if (pane) {
          const p = pane.getBoundingClientRect();
          if (clientY < p.top || clientY >= p.bottom) continue;
        }
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY < rect.bottom) {
          const minute = Math.floor((clientX - rect.left) / pxPerMinute);
          return { kind, id, minute };
        }
      }
      return null;
    },
    [pxPerMinute]
  );

  const snap = useCallback(
    (minute: number) => Math.round(minute / slotMinutes) * slotMinutes,
    [slotMinutes]
  );
  const snapFloor = useCallback(
    (minute: number) => Math.floor(minute / slotMinutes) * slotMinutes,
    [slotMinutes]
  );
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  /** Client-seitige Validierung einer Vorschau (harte Regeln + Verfügbarkeits-Warnung) */
  const validate = useCallback(
    (
      stationId: number,
      userCID: number | null,
      start: number,
      end: number,
      ignoreId?: number
    ): DragValidity => {
      const station = stationById.get(stationId);
      if (!station) {
        return { valid: false, warn: false, reason: "Unbekannte Station" };
      }

      // Station darf nur einen Block gleichzeitig haben (Controller oder Custom)
      const occupied = stationOccupied(assignments, stationId, start, end, ignoreId);
      if (occupied) {
        return {
          valid: false,
          warn: false,
          reason: `${station.callsign} ist in diesem Zeitraum bereits belegt`,
        };
      }

      // Custom-Block: keine Controller-Prüfungen
      if (userCID == null) {
        return { valid: true, warn: false, reason: null };
      }

      const controller = controllerByCid.get(userCID);
      if (!controller) {
        return { valid: false, warn: false, reason: "Unbekannter Controller" };
      }
      const overlap = hasOverlap(assignments, userCID, start, end, ignoreId);
      if (overlap) {
        const other = stationById.get(overlap.stationId);
        return {
          valid: false,
          warn: false,
          reason: `${controller.name} ist dann bereits auf ${other?.callsign ?? "?"} eingeplant`,
        };
      }
      // Ab hier: erlaubt, aber im Plan sichtbar zu markieren. Der Grund steht
      // in der Meldung, weil er über die Lösung entscheidet.
      const meta = stationMetaFor(station.callsign);
      const check = checkEligibility(controller, meta, event.airports);
      if (!check.ok) {
        const reason =
          check.reason === "excluded_airport"
            ? `${controller.name} hat ${check.airport} bei der Anmeldung abgewählt – wird markiert`
            : check.reason === "missing_familiarization"
            ? `${controller.name} fehlt die Familiarisierung für ${check.missing.join(", ")} – wird markiert`
            : check.reason === "missing_ctr_endorsement"
            ? `${controller.name} fehlt die Freigabe für ${check.callsign} (Tier 1) – wird markiert`
            : `${controller.name} darf ${station.callsign} nicht besetzen (benötigt ${
                check.needs
              }, freigegeben: ${
                check.allowed.length > 0 ? check.allowed.join(", ") : "nichts"
              }) – wird markiert`;
        return { valid: true, warn: true, reason };
      }
      if (controller.withdrawn) {
        return {
          valid: true,
          warn: true,
          reason: `${controller.name} hat die Anmeldung zurückgezogen – wird markiert`,
        };
      }
      if (isUnavailable(controller, start, end)) {
        return {
          valid: true,
          warn: true,
          reason: `${controller.name} ist laut Anmeldung nicht verfügbar`,
        };
      }
      return { valid: true, warn: false, reason: null };
    },
    [assignments, controllerByCid, event.airports, stationById, stationMetaFor]
  );

  const dragValidity: DragValidity | null = useMemo(() => {
    if (!drag) return null;
    if (drag.kind === "reorder-station") return null;
    // Gruppenverschiebung wird geschlossen geprüft, nicht Block für Block
    if (drag.kind === "move-group") return null;
    if (drag.kind === "create") return { valid: true, warn: false, reason: null };
    if (drag.kind === "assign-controller") {
      if (drag.stationId === null || drag.start === null || drag.end === null) {
        return { valid: false, warn: false, reason: null };
      }
      return validate(drag.stationId, drag.userCID, drag.start, drag.end);
    }
    return validate(drag.stationId, drag.userCID, drag.start, drag.end, drag.assignmentId);
  }, [drag, validate]);

  /** Standarddauer beim Ablegen eines Controllers: bis zum nächsten Hindernis, max. 60 min */
  const defaultRangeAt = useCallback(
    (stationId: number, startMinute: number): { start: number; end: number } | null => {
      const start = clamp(snapFloor(startMinute), 0, totalMinutes - slotMinutes);
      let end = Math.min(start + DEFAULT_DURATION, totalMinutes);
      const next = assignments
        .filter((a) => a.stationId === stationId && a.start > start)
        .sort((a, b) => a.start - b.start)[0];
      if (next) end = Math.min(end, next.start);
      if (end <= start) return null;
      return { start, end };
    },
    [assignments, snapFloor, totalMinutes, slotMinutes]
  );

  // Ein laufender Drag als Ref (Pointer-Deltas etc. ohne Re-Render)
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    original?: Assignment;
    anchorMinute?: number;
  } | null>(null);

  // Spiegel des Drag-States als Ref: Pointer-Up-Handler lesen hieraus,
  // damit Seiteneffekte nie in setState-Updatern laufen (StrictMode-sicher)
  const dragRef = useRef<DragState | null>(null);
  const applyDrag = useCallback((d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  }, []);

  const trackPointer = useCallback(
    (
      onMove: (e: PointerEvent) => void,
      onUp: (e: PointerEvent) => void
    ) => {
      const move = (e: PointerEvent) => onMove(e);
      const up = (e: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        onUp(e);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    []
  );

  /** Block verschieben (horizontal = Zeit, vertikal = Station bzw. Controller) */
  /**
   * Mehrere Blöcke gemeinsam in der Zeit verschieben.
   *
   * Geprüft wird der Zielzustand als Ganzes: Sonst kollidierte jeder Block mit
   * der alten Position seiner Nachbarn und keine Gruppenverschiebung käme je
   * durch. Passt eine Position nicht, bleibt alles unverändert – ein halb
   * verschobener Plan wäre schlimmer als gar keiner.
   */
  const moveSelection = useCallback(
    (ids: number[], deltaMinutes: number) => {
      if (deltaMinutes === 0 || ids.length === 0) return;
      const idSet = new Set(ids);
      const target = assignmentsRef.current.map((a) =>
        idSet.has(a.id) ? { ...a, start: a.start + deltaMinutes, end: a.end + deltaMinutes } : a
      );

      for (const a of target) {
        if (!idSet.has(a.id)) continue;
        if (a.start < 0 || a.end > totalMinutes) {
          toast.error("Verschieben nicht möglich: außerhalb des Eventzeitraums");
          return;
        }
        const stationClash = target.find(
          (o) => o.id !== a.id && o.stationId === a.stationId && o.start < a.end && a.start < o.end
        );
        if (stationClash) {
          const cs = stationById.get(a.stationId)?.callsign ?? "die Station";
          toast.error(`Verschieben nicht möglich: ${cs} wäre doppelt belegt`);
          return;
        }
        if (a.userCID != null) {
          const userClash = target.find(
            (o) => o.id !== a.id && o.userCID === a.userCID && o.start < a.end && a.start < o.end
          );
          if (userClash) {
            const who = controllerByCid.get(a.userCID)?.name ?? "Der Controller";
            toast.error(`Verschieben nicht möglich: ${who} wäre doppelt eingeplant`);
            return;
          }
        }
      }

      for (const id of ids) {
        const a = assignmentsRef.current.find((x) => x.id === id);
        if (!a) continue;
        updateAssignment(id, { start: a.start + deltaMinutes, end: a.end + deltaMinutes });
      }
    },
    [totalMinutes, updateAssignment, stationById, controllerByCid]
  );

  const startMove = useCallback(
    (e: React.PointerEvent, assignment: Assignment) => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      const dur = assignment.end - assignment.start;
      const additive = e.ctrlKey || e.metaKey;
      // Zieht man an einem Block, der Teil einer Mehrfachauswahl ist, wandert
      // die ganze Auswahl mit – sonst nur dieser eine Block.
      const groupIds =
        !additive && selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(assignment.id)
          ? [...selectedIdsRef.current]
          : null;
      gestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        original: assignment,
      };
      trackPointer(
        (ev) => {
          const g = gestureRef.current;
          if (!g?.original) return;
          if (Math.abs(ev.clientX - g.startX) + Math.abs(ev.clientY - g.startY) > 4) {
            g.moved = true;
          }
          if (!g.moved) return;
          const rawDelta = snap((ev.clientX - g.startX) / pxPerMinute);

          if (groupIds) {
            // Delta so begrenzen, dass kein Block der Gruppe aus dem Event fällt
            const blocks = assignmentsRef.current.filter((a) => groupIds.includes(a.id));
            const minStart = Math.min(...blocks.map((a) => a.start));
            const maxEnd = Math.max(...blocks.map((a) => a.end));
            const deltaMinutes = clamp(rawDelta, -minStart, totalMinutes - maxEnd);
            applyDrag({ kind: "move-group", assignmentIds: groupIds, deltaMinutes });
            return;
          }

          const start = clamp(g.original.start + rawDelta, 0, totalMinutes - dur);
          const hit = hitTest(ev.clientX, ev.clientY);
          const isCustom = g.original.type === "custom";
          let stationId = g.original.stationId;
          let userCID = g.original.userCID;
          if (hit?.kind === "station") stationId = hit.id;
          // Nur Controller-Blöcke lassen sich auf eine andere Controller-Zeile ziehen
          if (hit?.kind === "controller" && !isCustom) userCID = hit.id;
          applyDrag({
            kind: "move",
            assignmentId: g.original.id,
            start,
            end: start + dur,
            stationId,
            userCID,
          });
        },
        () => {
          const g = gestureRef.current;
          const current = dragRef.current;
          gestureRef.current = null;
          applyDrag(null);
          if (!g?.original) return;
          const clicked = g.original;

          if (!g.moved) {
            // Klick ohne Bewegung: mit Strg/Cmd sammeln, sonst einzeln wählen
            setSelectedIds((prev) => {
              if (additive) {
                const next = new Set(prev);
                if (next.has(clicked.id)) next.delete(clicked.id);
                else next.add(clicked.id);
                return next;
              }
              return prev.size === 1 && prev.has(clicked.id) ? new Set() : new Set([clicked.id]);
            });
            if (clicked.userCID != null) setSelectedCID(clicked.userCID);
            return;
          }

          if (current?.kind === "move-group") {
            moveSelection(current.assignmentIds, current.deltaMinutes);
            return;
          }
          if (!current || current.kind !== "move") return;

          const changed =
            current.start !== clicked.start ||
            current.stationId !== clicked.stationId ||
            current.userCID !== clicked.userCID;
          if (!changed) return;
          const v = validate(
            current.stationId,
            current.userCID,
            current.start,
            current.end,
            clicked.id
          );
          if (!v.valid) {
            if (v.reason) toast.error(v.reason);
          } else {
            if (v.warn && v.reason) toast.warning(v.reason);
            updateAssignment(clicked.id, {
              stationId: current.stationId,
              userCID: current.userCID,
              start: current.start,
              end: current.end,
            });
          }
        }
      );
    },
    [
      canEdit,
      trackPointer,
      snap,
      pxPerMinute,
      totalMinutes,
      hitTest,
      validate,
      updateAssignment,
      applyDrag,
      moveSelection,
    ]
  );

  /** Schicht am Rand länger/kürzer ziehen */
  const startResize = useCallback(
    (e: React.PointerEvent, assignment: Assignment, edge: "start" | "end") => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      gestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        original: assignment,
      };
      trackPointer(
        (ev) => {
          const g = gestureRef.current;
          if (!g?.original) return;
          g.moved = true;
          const deltaMin = snap((ev.clientX - g.startX) / pxPerMinute);
          let { start, end } = g.original;
          if (edge === "start") {
            start = clamp(g.original.start + deltaMin, 0, g.original.end - slotMinutes);
          } else {
            end = clamp(g.original.end + deltaMin, g.original.start + slotMinutes, totalMinutes);
          }
          applyDrag({
            kind: edge === "start" ? "resize-start" : "resize-end",
            assignmentId: g.original.id,
            start,
            end,
            stationId: g.original.stationId,
            userCID: g.original.userCID,
          });
        },
        () => {
          const g = gestureRef.current;
          const current = dragRef.current;
          gestureRef.current = null;
          applyDrag(null);
          if (
            g?.original &&
            current &&
            (current.kind === "resize-start" || current.kind === "resize-end") &&
            (current.start !== g.original.start || current.end !== g.original.end)
          ) {
            const v = validate(
              current.stationId,
              current.userCID,
              current.start,
              current.end,
              g.original.id
            );
            if (!v.valid) {
              if (v.reason) toast.error(v.reason);
            } else {
              if (v.warn && v.reason) toast.warning(v.reason);
              updateAssignment(g.original.id, { start: current.start, end: current.end });
            }
          }
        }
      );
    },
    [canEdit, trackPointer, snap, pxPerMinute, slotMinutes, totalMinutes, validate, updateAssignment, applyDrag]
  );

  /** Auf freier Fläche einer Stationszeile ziehen → Zeitraum wählen → Dialog */
  const startCreate = useCallback(
    (e: React.PointerEvent, stationId: number) => {
      if (!canEdit) return;
      if (e.button !== 0) return;
      const row = rowRefs.current.get(`station-${stationId}`);
      if (!row) return;
      e.preventDefault();
      const rect = row.el.getBoundingClientRect();
      const anchor = clamp(
        snapFloor((e.clientX - rect.left) / pxPerMinute),
        0,
        totalMinutes - slotMinutes
      );
      gestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        anchorMinute: anchor,
      };
      applyDrag({ kind: "create", stationId, start: anchor, end: anchor + slotMinutes });
      trackPointer(
        (ev) => {
          const g = gestureRef.current;
          if (!g || g.anchorMinute === undefined) return;
          if (Math.abs(ev.clientX - g.startX) > 4) g.moved = true;
          const cur = clamp(
            snapFloor((ev.clientX - rect.left) / pxPerMinute),
            0,
            totalMinutes - slotMinutes
          );
          const start = Math.min(g.anchorMinute, cur);
          const end = Math.max(g.anchorMinute, cur) + slotMinutes;
          applyDrag({ kind: "create", stationId, start, end });
        },
        () => {
          const g = gestureRef.current;
          const current = dragRef.current;
          gestureRef.current = null;
          applyDrag(null);
          if (!current || current.kind !== "create") return;
          let { start, end } = current;
          // Klick ohne Ziehen → Standarddauer verwenden
          if (!g?.moved) {
            const range = defaultRangeAt(stationId, start);
            if (!range) return;
            start = range.start;
            end = range.end;
          }
          if (!stationOccupied(assignments, stationId, start, end)) {
            setAssignDialog({ stationId, start, end });
          } else {
            toast.error("Dieser Zeitraum ist bereits (teilweise) besetzt");
          }
        }
      );
    },
    [
      canEdit,
      pxPerMinute,
      snapFloor,
      slotMinutes,
      totalMinutes,
      trackPointer,
      defaultRangeAt,
      assignments,
      applyDrag,
    ]
  );

  /** Controller aus der unteren Liste auf eine Station ziehen */
  const startAssignDrag = useCallback(
    (e: React.PointerEvent, userCID: number) => {
      if (!canEdit) return;
      if (e.button !== 0) return;
      e.preventDefault();
      gestureRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
      applyDrag({ kind: "assign-controller", userCID, stationId: null, start: null, end: null });
      trackPointer(
        (ev) => {
          const g = gestureRef.current;
          if (!g) return;
          if (Math.abs(ev.clientX - g.startX) + Math.abs(ev.clientY - g.startY) > 4) {
            g.moved = true;
          }
          const hit = hitTest(ev.clientX, ev.clientY);
          if (hit?.kind === "station") {
            const range = defaultRangeAt(hit.id, hit.minute);
            applyDrag({
              kind: "assign-controller",
              userCID,
              stationId: hit.id,
              start: range?.start ?? null,
              end: range?.end ?? null,
            });
          } else {
            applyDrag({ kind: "assign-controller", userCID, stationId: null, start: null, end: null });
          }
        },
        () => {
          const g = gestureRef.current;
          const current = dragRef.current;
          gestureRef.current = null;
          applyDrag(null);
          // Klick ohne Bewegung → Controller in der Seitenleiste auswählen
          if (!g?.moved) {
            setSelectedCID((sel) => (sel === userCID ? null : userCID));
            return;
          }
          if (
            current &&
            current.kind === "assign-controller" &&
            current.stationId !== null &&
            current.start !== null &&
            current.end !== null
          ) {
            const v = validate(current.stationId, current.userCID, current.start, current.end);
            if (!v.valid) {
              if (v.reason) toast.error(v.reason);
            } else {
              if (v.warn && v.reason) toast.warning(v.reason);
              createAssignment(current.stationId, current.start, current.end, {
                userCID: current.userCID,
              });
            }
          }
        }
      );
    },
    [canEdit, trackPointer, hitTest, defaultRangeAt, validate, createAssignment, applyDrag]
  );

  /** Station (per Griff am Zeilenkopf) vertikal umsortieren */
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const startReorder = useCallback(
    (e: React.PointerEvent, stationId: number) => {
      if (!canEdit) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      gestureRef.current = { startX: e.clientX, startY: e.clientY, moved: false };

      // Zeilengeometrie beim Start einfrieren. Würde man während des Ziehens
      // das DOM abfragen, läse man die bereits umsortierte Vorschau – der
      // Zielindex spränge dadurch zurück und die Zeilen flackerten.
      // Bei mehreren Airports wird nur innerhalb der eigenen Gruppe sortiert:
      // Zu welchem Airport eine Station gehört, ergibt sich aus ihrem Callsign
      // und nicht aus ihrer Position – ein Zug über die Gruppengrenze wäre
      // deshalb sinnlos.
      const dragged = stationsRef.current.find((st) => st.id === stationId);
      const draggedAirport = dragged ? airportOfRef.current(dragged.callsign) : null;
      const frozen = stationsRef.current
        .filter((st) => !groupByAirport || airportOfRef.current(st.callsign) === draggedAirport)
        .map((st) => {
          const row = rowRefs.current.get(`station-${st.id}`);
          if (!row) return null;
          const r = row.el.getBoundingClientRect();
          return { id: st.id, top: r.top, bottom: r.bottom };
        })
        .filter((x): x is { id: number; top: number; bottom: number } => x !== null);

      // Scrollt der Nutzer während des Ziehens, verschieben sich die
      // eingefrorenen Werte – deshalb den Versatz mitrechnen.
      const scroller = (() => {
        let el: HTMLElement | null = rowRefs.current.get(`station-${stationId}`)?.el ?? null;
        while (el) {
          const oy = getComputedStyle(el).overflowY;
          if (oy === "auto" || oy === "scroll") return el;
          el = el.parentElement;
        }
        return null;
      })();
      const scrollStart = scroller?.scrollTop ?? 0;

      const targetAt = (clientY: number): number | null => {
        if (frozen.length === 0) return null;
        const y = clientY + ((scroller?.scrollTop ?? 0) - scrollStart);
        if (y <= frozen[0].top) return frozen[0].id;
        const last = frozen[frozen.length - 1];
        if (y >= last.bottom) return last.id;
        return frozen.find((f) => y >= f.top && y < f.bottom)?.id ?? null;
      };

      applyDrag({ kind: "reorder-station", stationId, overStationId: null });
      trackPointer(
        (ev) => {
          const g = gestureRef.current;
          if (!g) return;
          if (Math.abs(ev.clientY - g.startY) > 4) g.moved = true;
          applyDrag({
            kind: "reorder-station",
            stationId,
            overStationId: targetAt(ev.clientY),
          });
        },
        () => {
          const g = gestureRef.current;
          const current = dragRef.current;
          gestureRef.current = null;
          applyDrag(null);
          if (
            !g?.moved ||
            !current ||
            current.kind !== "reorder-station" ||
            current.overStationId === null ||
            current.overStationId === stationId
          ) {
            return;
          }
          const prev = stationsRef.current;
          const from = prev.findIndex((s) => s.id === stationId);
          const to = prev.findIndex((s) => s.id === current.overStationId);
          if (from < 0 || to < 0) return;
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          setStations(next);
          persistStationOrder(next);
        }
      );
    },
    [canEdit, trackPointer, applyDrag, persistStationOrder, groupByAirport]
  );

  // ------------------------------------------------------------------
  // Abgeleitete Anzeige-Daten
  // ------------------------------------------------------------------
  /** Stationen inkl. Reorder-Vorschau */
  const displayStations = useMemo(() => {
    if (drag?.kind !== "reorder-station" || drag.overStationId === null) return stations;
    const from = stations.findIndex((s) => s.id === drag.stationId);
    const to = stations.findIndex((s) => s.id === drag.overStationId);
    if (from < 0 || to < 0) return stations;
    const next = [...stations];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }, [stations, drag]);

  /**
   * Stationszeilen, bei mehreren Airports in Gruppen gebündelt.
   *
   * Die Reihenfolge der Gruppen ergibt sich aus der Stationsreihenfolge (erstes
   * Auftreten), nicht aus der Event-Definition: Nur so lässt sie sich im Editor
   * ändern und bleibt gespeichert – die Sortierung der Stationen ist bereits
   * persistent.
   */
  const stationGroups = useMemo((): { airport: string | null; stations: typeof stations }[] => {
    if (!groupByAirport) return [{ airport: null, stations: displayStations }];
    const grouped = new Map<string, typeof stations>();
    for (const st of displayStations) {
      const ap = airportOf(st.callsign);
      const list = grouped.get(ap);
      if (list) list.push(st);
      else grouped.set(ap, [st]);
    }
    return [...grouped.entries()].map(([airport, list]) => ({ airport, stations: list }));
  }, [displayStations, groupByAirport, airportOf]);

  /** Eingeklappte Airport-Gruppen – bei vielen Airports wird der Plan sonst zu hoch */
  const [collapsedAirports, setCollapsedAirports] = useState<Set<string>>(new Set());
  useEffect(() => {
    const stored = window.localStorage.getItem(`${COLLAPSE_PREF_KEY}:${event.id}`);
    if (stored) {
      try {
        const list = JSON.parse(stored) as string[];
        if (Array.isArray(list)) setCollapsedAirports(new Set(list));
      } catch {
        // ungültiger Eintrag – ignorieren
      }
    }
  }, [event.id]);
  const toggleAirportCollapsed = useCallback(
    (airport: string) => {
      setCollapsedAirports((prev) => {
        const next = new Set(prev);
        if (next.has(airport)) next.delete(airport);
        else next.add(airport);
        window.localStorage.setItem(
          `${COLLAPSE_PREF_KEY}:${event.id}`,
          JSON.stringify([...next])
        );
        return next;
      });
    },
    [event.id]
  );

  /**
   * Eine ganze Airport-Gruppe verschieben.
   *
   * Bewusst über Schaltflächen statt Ziehen: Der Zeilen-Drag ist bereits mit
   * dem Umsortieren einzelner Stationen belegt, und bei einer Handvoll Gruppen
   * ist ein Klick ohnehin der kürzere Weg.
   */
  const moveAirportGroup = useCallback(
    (airport: string, direction: -1 | 1) => {
      const order: string[] = [];
      for (const st of stationsRef.current) {
        const ap = airportOfRef.current(st.callsign);
        if (!order.includes(ap)) order.push(ap);
      }
      const from = order.indexOf(airport);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return;
      const nextOrder = [...order];
      [nextOrder[from], nextOrder[to]] = [nextOrder[to], nextOrder[from]];

      // Stationen entlang der neuen Gruppenreihenfolge neu zusammensetzen;
      // innerhalb einer Gruppe bleibt die bisherige Reihenfolge erhalten.
      const next = nextOrder.flatMap((ap) =>
        stationsRef.current.filter((st) => airportOfRef.current(st.callsign) === ap)
      );
      setStations(next);
      persistStationOrder(next);
    },
    [persistStationOrder]
  );

  /** Beim Controller-Drag: Verfügbarkeits-/Belegungs-Overlay für Stationszeilen */
  const dragControllerOverlay = useMemo(() => {
    if (drag?.kind !== "assign-controller") return null;
    const c = controllerByCid.get(drag.userCID);
    if (!c) return null;
    return {
      unavailable: c.unavailable,
      busy: assignments
        .filter((a) => a.userCID === drag.userCID)
        .map((a) => ({ start: a.start, end: a.end })),
      prefers: (callsign: string) =>
        c.preferredStations.toUpperCase().includes(callsign.toUpperCase()),
    };
  }, [drag, controllerByCid, assignments]);
  /** Zuweisungen inkl. Drag-Vorschau */
  const displayAssignments = useMemo(() => {
    if (!drag) return assignments;
    if (drag.kind === "move-group") {
      const ids = new Set(drag.assignmentIds);
      return assignments.map((a) =>
        ids.has(a.id)
          ? { ...a, start: a.start + drag.deltaMinutes, end: a.end + drag.deltaMinutes }
          : a
      );
    }
    if (drag.kind !== "move" && drag.kind !== "resize-start" && drag.kind !== "resize-end") {
      return assignments;
    }
    return assignments.map((a) =>
      a.id === drag.assignmentId
        ? { ...a, start: drag.start, end: drag.end, stationId: drag.stationId, userCID: drag.userCID }
        : a
    );
  }, [assignments, drag]);

  const allWarnings = useMemo(
    () =>
      computeWarnings(
        assignments,
        stations,
        controllers,
        eventStart,
        stationMetaFor,
        event.airports
      ),
    [assignments, stations, controllers, eventStart, stationMetaFor, event.airports]
  );

  // Bewusst geprüfte Hinweise verschwinden aus der Liste. Der Stand kommt vom
  // Server, damit er für alle Bearbeiter gilt; lokal wird er sofort gespiegelt,
  // damit das Ausblenden nicht auf den Roundtrip wartet.
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDismissedKeys(new Set(roster.dismissedWarnings ?? []));
  }, [roster.dismissedWarnings]);

  const warnings = useMemo(
    () => allWarnings.filter((w) => !dismissedKeys.has(warningKey(w))),
    [allWarnings, dismissedKeys]
  );
  // Nur die ausgeblendeten Hinweise, die aktuell noch zutreffen – Schlüssel zu
  // längst geänderten Blöcken sollen nicht als Altlast in der Liste stehen.
  const dismissedWarnings = useMemo(
    () => allWarnings.filter((w) => dismissedKeys.has(warningKey(w))),
    [allWarnings, dismissedKeys]
  );

  /** Hinweis ausblenden bzw. wieder einblenden */
  const setWarningDismissed = useCallback(
    async (key: string, dismissed: boolean) => {
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        if (dismissed) next.add(key);
        else next.delete(key);
        return next;
      });
      try {
        const res = await fetch(`/api/events/${event.id}/roster/warnings`, {
          method: "PUT",
          headers: apiHeaders,
          body: JSON.stringify({ key, dismissed }),
        });
        if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      } catch {
        // Zurückdrehen, damit die Anzeige nicht lügt
        setDismissedKeys((prev) => {
          const next = new Set(prev);
          if (dismissed) next.delete(key);
          else next.add(key);
          return next;
        });
        toast.error("Hinweis konnte nicht gespeichert werden");
      }
    },
    [event.id, apiHeaders]
  );
  const warningsByAssignment = useMemo(() => {
    const map = new Map<number, RosterWarning[]>();
    for (const w of warnings) {
      for (const id of w.assignmentIds) {
        (map.get(id) ?? map.set(id, []).get(id)!).push(w);
      }
    }
    return map;
  }, [warnings]);

  const assignedMinutes = useMemo(
    () => assignedMinutesByController(assignments),
    [assignments]
  );

  // Ausgewählter Controller für die Seitenleiste
  const selectedController: RosterController | null = useMemo(
    () => (selectedCID != null ? controllerByCid.get(selectedCID) ?? null : null),
    [selectedCID, controllerByCid]
  );
  const selectedShiftLabels = useMemo(() => {
    if (selectedCID == null) return [];
    return assignments
      .filter((a) => a.userCID === selectedCID)
      .sort((a, b) => a.start - b.start)
      .map((a) => {
        const st = stationById.get(a.stationId)?.callsign ?? "?";
        return `${st} ${minuteToHM(eventStart, a.start)}–${minuteToHM(eventStart, a.end)}z`;
      });
  }, [selectedCID, assignments, stationById, eventStart]);

  /**
   * Trifft der Suchtext Stationen des Rosters?
   *
   * Beim Planen wird oft nach der Position gesucht, nicht nach der Person –
   * „EDDF_TWR" soll alle zeigen, die dort sitzen dürfen. Ab drei Zeichen, damit
   * nicht jedes „ED" die halbe Liste erfasst.
   */
  const matchedStations = useMemo(() => {
    const q = controllerSearch.trim().toUpperCase();
    if (q.length < 3) return [];
    return stations.filter((st) => st.callsign.toUpperCase().includes(q));
  }, [controllerSearch, stations]);

  const visibleControllers = useMemo(() => {
    const q = controllerSearch.trim().toLowerCase();
    let list = controllers;
    if (q) {
      // Neben Namen und CID auch Wünsche, Remarks und interne Notiz – und wenn
      // der Text eine Station trifft, alle die sie besetzen dürfen.
      const eligibleForMatch = (c: RosterController) =>
        matchedStations.some((st) =>
          checkEligibility(c, stationMetaFor(st.callsign), event.airports).ok
        );
      list = list.filter((c) => {
        const mark = markByCid.get(c.cid);
        return (
          c.name.toLowerCase().includes(q) ||
          String(c.cid).includes(q) ||
          c.preferredStations.toLowerCase().includes(q) ||
          (c.remarks ?? "").toLowerCase().includes(q) ||
          (mark?.note ?? "").toLowerCase().includes(q) ||
          eligibleForMatch(c)
        );
      });
    }
    // Airport-Eingrenzung: Wer dort nichts darf oder ihn abgewählt hat, ist
    // für diesen Teil des Plans ohne Belang.
    if (airportFilter) {
      list = list.filter((c) => {
        if (hasExcludedAirport(c.entry, airportFilter)) return false;
        const levels = c.entry.airportEndorsements?.[airportFilter]?.allowedLevels;
        // Ohne Auswertung nicht ausschließen – sonst verschwinden Anmeldungen,
        // deren Endorsements gerade nicht abrufbar waren.
        return levels === undefined || levels.length > 0;
      });
    }
    if (flagFilter.size > 0) {
      list = list.filter((c) => {
        const flag = markByCid.get(c.cid)?.flag ?? null;
        return flag !== null && flagFilter.has(flag);
      });
    }
    // Der eigentliche Planungsfilter: Wer darf diese Station besetzen?
    // Beantwortet in einem Schritt, wofür man sonst jede Zeile lesen müsste.
    if (stationFilter !== null) {
      const station = stations.find((st) => st.id === stationFilter);
      if (station) {
        const meta = stationMetaFor(station.callsign);
        list = list.filter(
          (c) => checkEligibility(c, meta, event.airports).ok
        );
      }
    }
    if (onlyUnscheduled) {
      list = list.filter((c) => (assignedMinutes.get(c.cid) ?? 0) === 0);
    }
    // Abgemeldete ohne Zuweisung sind für die Planung irrelevant und würden
    // die Liste nur aufblähen – abgemeldete MIT Zuweisung müssen sichtbar sein.
    list = list.filter(
      (c) => !c.withdrawn || assignments.some((a) => a.userCID === c.cid)
    );
    if (controllerSort === "group") {
      // Nach Ebene DEL → CTR: Wer nur Delivery darf, steht oben. Das entspricht
      // der Reihenfolge, in der ein Plan meist gefüllt wird – und stellt die
      // wenigen hochberechtigten Leute ans Ende, wo man sie gezielt sucht.
      const rank = (c: RosterController) => {
        const group = airportFilter
          ? getControllerGroupForStation(c.entry, airportFilter, event.airports)
          : getControllerGroupForStation(c.entry, null, event.airports);
        const idx = group ? STATION_GROUP_ORDER.indexOf(group) : -1;
        return idx < 0 ? STATION_GROUP_ORDER.length : idx;
      };
      list = [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    } else if (controllerSort === "assigned") {
      list = [...list].sort(
        (a, b) => (assignedMinutes.get(b.cid) ?? 0) - (assignedMinutes.get(a.cid) ?? 0)
      );
    } else if (controllerSort === "flag") {
      // Markierte zuerst (grün → orange → rot), Unmarkierte ans Ende
      const rank = (cid: number) => {
        const flag = markByCid.get(cid)?.flag ?? null;
        return flag === null ? ROSTER_FLAGS.length : ROSTER_FLAGS.indexOf(flag);
      };
      list = [...list].sort((a, b) => {
        const d = rank(a.cid) - rank(b.cid);
        return d !== 0 ? d : a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [
    controllers,
    controllerSearch,
    controllerSort,
    assignedMinutes,
    assignments,
    markByCid,
    flagFilter,
    stationFilter,
    airportFilter,
    onlyUnscheduled,
    stations,
    stationMetaFor,
    event.airports,
    matchedStations,
  ]);

  /**
   * Auswahl für den Stationsfilter. Ist ein Airport gewählt, stehen dort nur
   * dessen Stationen – die Liste soll die Eingrenzung nicht wieder aufweichen.
   */
  const filterStations = useMemo(
    () =>
      airportFilter
        ? stations.filter((st) => airportOf(st.callsign) === airportFilter)
        : stations,
    [stations, airportFilter, airportOf]
  );

  // Wechselt der Airport, passt die gewählte Station womöglich nicht mehr dazu
  useEffect(() => {
    if (stationFilter === null) return;
    if (!filterStations.some((st) => st.id === stationFilter)) setStationFilter(null);
  }, [filterStations, stationFilter]);

  /** Wie viele Controller tragen welche Markierung? (für die Filter-Chips) */
  const flagCounts = useMemo(() => {
    const counts: Record<RosterFlag, number> = { green: 0, amber: 0, red: 0 };
    for (const c of controllers) {
      const flag = markByCid.get(c.cid)?.flag ?? null;
      if (flag) counts[flag] += 1;
    }
    return counts;
  }, [controllers, markByCid]);

  const toggleFlagFilter = useCallback((flag: RosterFlag) => {
    setFlagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      return next;
    });
  }, []);

  // Header-Slots
  const slots = useMemo(() => {
    const arr: { minute: number; label: string; isHour: boolean }[] = [];
    for (let i = 0; i < slotCount; i++) {
      const minute = i * slotMinutes;
      const d = minuteToDate(eventStart, minute);
      arr.push({
        minute,
        label: minuteToHM(eventStart, minute),
        isHour: d.getUTCMinutes() === 0,
      });
    }
    return arr;
  }, [slotCount, slotMinutes, eventStart]);

  const hourPx = pxPerMinute * 60;
  const gridBackground = {
    backgroundImage: `repeating-linear-gradient(to right, rgba(120,120,120,0.35) 0 1px, transparent 1px ${hourPx}px), repeating-linear-gradient(to right, rgba(120,120,120,0.13) 0 1px, transparent 1px ${pxPerSlot}px)`,
  };

  /** Unbesetzte Bereiche einer Station */
  const uncoveredRanges = useCallback(
    (stationId: number): { start: number; end: number }[] => {
      const list = displayAssignments
        .filter((a) => a.stationId === stationId)
        .sort((a, b) => a.start - b.start);
      const gaps: { start: number; end: number }[] = [];
      let cursor = 0;
      for (const a of list) {
        if (a.start > cursor) gaps.push({ start: cursor, end: a.start });
        cursor = Math.max(cursor, a.end);
      }
      if (cursor < totalMinutes) gaps.push({ start: cursor, end: totalMinutes });
      return gaps;
    },
    [displayAssignments, totalMinutes]
  );

  // ------------------------------------------------------------------
  // Export & Veröffentlichen
  // ------------------------------------------------------------------
  const exportCsv = () => {
    const csv = rosterToCsv(assignments, stations, controllers, eventStart);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = async () => {
    const text = rosterToText(assignments, stations, controllers, eventStart);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Roster in die Zwischenablage kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  /**
   * Friert den aktuellen Arbeitsstand als veröffentlichte Fassung ein.
   * Beim ersten Mal wechselt zusätzlich der Event-Status und die
   * Teilnehmer werden benachrichtigt; danach gehen nur noch die Änderungen
   * live, ohne erneute Benachrichtigung.
   */
  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/events/${event.id}/roster/publish`, {
        method: "POST",
        headers: apiHeaders,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Veröffentlichen fehlgeschlagen");
      }
      const j = await res.json();
      if (j.firstPublish) {
        toast.success("Roster veröffentlicht – die Teilnehmer wurden benachrichtigt");
        onEventStatusChanged("ROSTER_PUBLISHED");
      } else {
        toast.success("Änderungen sind jetzt für die Teilnehmer sichtbar");
      }
      setPublishDialogOpen(false);
      onReloadRef.current();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen");
    } finally {
      setPublishing(false);
    }
  };

  /** Setzt die Besetzung zurück, auf Wunsch mit vorherigem Snapshot */
  const resetRoster = async (withSnapshot: boolean) => {
    setResetting(true);
    try {
      const res = await fetch(`/api/events/${event.id}/roster/reset`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ snapshot: withSnapshot }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Zurücksetzen fehlgeschlagen");
      }
      toast.success(
        withSnapshot
          ? "Besetzung zurückgesetzt – ein Snapshot wurde vorher gespeichert"
          : "Besetzung zurückgesetzt"
      );
      setSelectedId(null);
      setResetDialogOpen(false);
      onReloadRef.current();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Zurücksetzen fehlgeschlagen");
    } finally {
      setResetting(false);
    }
  };

  // ------------------------------------------------------------------
  // Render-Helfer
  // ------------------------------------------------------------------
  const renderBlock = (
    a: Assignment,
    board: "station" | "controller"
  ): React.ReactNode => {
    const station = stationById.get(a.stationId);
    const controller = a.userCID != null ? controllerByCid.get(a.userCID) : undefined;
    const meta = station ? stationMetaFor(station.callsign) : null;
    const isCustom = a.type === "custom";
    const isDragTarget =
      drag !== null &&
      (drag.kind === "move" || drag.kind === "resize-start" || drag.kind === "resize-end") &&
      drag.assignmentId === a.id;
    const blockWarnings = warningsByAssignment.get(a.id) ?? [];
    const selected = selectedIds.has(a.id);
    const hasWithdrawn = blockWarnings.some((w) => w.type === "withdrawn");
    const hasExcluded = blockWarnings.some((w) => w.type === "airport_excluded");
    const hasIneligible =
      blockWarnings.some(
        (w) => w.type === "not_eligible" || w.type === "missing_familiarization"
      ) || hasExcluded;

    // Controller-Blöcke: Farbton vom Airport, Helligkeit von der Ebene.
    // Custom-Blöcke behalten ihre frei gewählte Farbe als Klasse.
    const tone = isCustom
      ? null
      : stationBlockColors(meta?.airport ?? null, meta?.group ?? null, event.airports);
    let colorCls = isCustom ? customBlockClass(a.color) : "";
    let colorStyle: React.CSSProperties = tone
      ? { backgroundColor: tone.background, borderColor: tone.border, color: tone.text }
      : {};
    // Problemfälle bekommen einen deutlichen Rahmen, behalten aber die
    // Stationsfarbe – so bleibt die Zuordnung erkennbar.
    if (!isDragTarget && (hasWithdrawn || hasIneligible)) {
      colorCls += " ring-2 ring-inset ring-danger-500";
    }
    if (isDragTarget && dragValidity) {
      colorStyle = {};
      if (!dragValidity.valid) colorCls = "bg-destructive/80 border-destructive text-white";
      else if (dragValidity.warn) colorCls = "bg-amber-500/85 border-amber-600 text-white";
    }

    const who = isCustom ? a.label ?? "Custom" : controller?.name ?? `CID ${a.userCID}`;
    const label = board === "station" ? who : station?.callsign ?? "?";

    return (
      <div
        key={`${board}-${a.id}`}
        className={`absolute top-1 bottom-1 rounded-md border shadow-sm select-none overflow-hidden group ${
          tone ? "" : "text-white"
        } ${colorCls} ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${
          selected ? "ring-2 ring-offset-1 ring-primary" : ""
        } ${isDragTarget ? "opacity-90 z-30" : "z-10"}`}
        style={{
          left: a.start * pxPerMinute,
          width: Math.max((a.end - a.start) * pxPerMinute, 8),
          touchAction: "none",
          ...colorStyle,
        }}
        onPointerDown={(e) => startMove(e, a)}
        title={`${station?.callsign ?? "?"} • ${who}\n${minuteToHM(eventStart, a.start)}z – ${minuteToHM(eventStart, a.end)}z (${formatDuration(a.end - a.start)})${
          blockWarnings.length > 0 ? "\n⚠ " + blockWarnings.map((w) => w.message).join("\n⚠ ") : ""
        }`}
      >
        <div className="flex items-center gap-1 h-full px-1.5 text-[11px] font-medium">
          {/* Fehlende Freigabe: rotes Ausrufezeichen. Zurückgezogene Anmeldung:
              durchgestrichenes Nutzersymbol. Sonstige Hinweise: Warndreieck. */}
          {hasExcluded && (
            <span
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-danger-600 text-[9px] font-bold leading-none text-white"
              title="Airport bei der Anmeldung abgewählt"
            >
              <CircleSlash className="h-2.5 w-2.5" />
            </span>
          )}
          {blockWarnings.some(
            (w) => w.type === "not_eligible" || w.type === "missing_familiarization"
          ) && (
            <span
              title="Keine Freigabe für diese Station"
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-danger-600 text-[9px] font-bold leading-none text-white"
            >
              !
            </span>
          )}
          {blockWarnings.some((w) => w.type === "withdrawn") && (
            <UserX className="h-3 w-3 shrink-0 text-danger-200" />
          )}
          {blockWarnings.some(
            (w) =>
              w.type !== "not_eligible" &&
              w.type !== "withdrawn" &&
              w.type !== "airport_excluded" &&
              w.type !== "missing_familiarization"
          ) && <AlertTriangle className="h-3 w-3 text-yellow-200 shrink-0" />}
          <span className={cn("truncate", hasWithdrawn && "line-through decoration-2")}>
            {label}
          </span>
          <span className="hidden sm:inline text-[9px] opacity-75 truncate">
            {minuteToHM(eventStart, a.start)}–{minuteToHM(eventStart, a.end)}
          </span>
        </div>
        {canEdit && (
          <>
            {/* Resize-Griffe */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/25"
              onPointerDown={(e) => startResize(e, a, "start")}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/25"
              onPointerDown={(e) => startResize(e, a, "end")}
            />
            {/* Aktionen am ausgewählten Block */}
            {selected && (
              <div
                className="absolute right-0.5 top-0.5 flex items-center gap-0.5"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Farbe nur für freie Blöcke: Controller-Blöcke tragen die
                    Farbe ihrer Stationsgruppe und dürfen nicht abweichen. */}
                {isCustom && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="rounded-full bg-black/30 hover:bg-black/60 p-0.5"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Farbe des Blocks wählen"
                        title="Farbe wählen"
                      >
                        <Palette className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        Farbe
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {CUSTOM_BLOCK_COLORS.map((c) => (
                        <DropdownMenuItem
                          key={c}
                          className="gap-2"
                          onClick={() => updateAssignment(a.id, { color: c })}
                        >
                          <span
                            className={cn("h-2.5 w-2.5 rounded-full", CUSTOM_BLOCK_COLOR_DOT[c])}
                          />
                          {CUSTOM_BLOCK_COLOR_LABEL[c]}
                        </DropdownMenuItem>
                      ))}
                      {a.color && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => updateAssignment(a.id, { color: null })}>
                            Standard
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  className="rounded-full bg-black/30 hover:bg-black/60 p-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAssignment(a.id);
                  }}
                  aria-label="Zuweisung löschen"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  /** Eine Stationszeile (Beschriftung + Zeitstrahl) */
  const renderStationRow = (station: RosterStation): React.ReactNode => {
              const meta = stationMetaFor(station.callsign);
              // Verlangt der Datahub für diese Position Sektorkenntnis, gehört
              // das an die Zeile: Wer plant, sieht sonst erst beim Besetzen,
              // dass die halbe Liste ausfällt.
              const famRequirement = describeFamiliarizations(meta.requiredFamiliarizations);
              // Tier-1-Center: verlangt die Freigabe für genau diese Position,
              // nicht bloß die Ebene CTR. Das gehört sichtbar an die Zeile.
              const tier1Center = meta.group === "CTR" && meta.gcapStatus === "1";
              const coverage = stationCoverage(displayAssignments, station.id, totalMinutes);
              const isDropTarget =
                drag?.kind === "assign-controller" && drag.stationId === station.id;
              const isReordering =
                drag?.kind === "reorder-station" && drag.stationId === station.id;
              const dragPrefersHere =
                dragControllerOverlay?.prefers(station.callsign) ?? false;
              return (
                <div
                  key={station.id}
                  className={`flex border-b last:border-b-0 group/row ${
                    isReordering ? "opacity-60" : ""
                  }`}
                >
                  <div
                    className={`sticky left-0 z-20 bg-background border-r pl-1 shrink-0 flex items-center ${
                      isReordering ? "ring-2 ring-inset ring-primary rounded-sm" : ""
                    }`}
                    style={{ width: labelWidth, height: ROW_H }}
                  >
                    {/* Der Stationsname bleibt auf Grundbreite, auch wenn die
                        Infospalte die Beschriftung insgesamt verbreitert –
                        sonst driften Name und Freigabe-Badge auseinander. */}
                    <div
                      className="flex items-center justify-between gap-1.5 pr-3 min-w-0"
                      style={{ width: LABEL_W }}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {canEdit && (
                          <button
                            className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                            style={{ touchAction: "none" }}
                            onPointerDown={(e) => startReorder(e, station.id)}
                            aria-label={`${station.callsign} umsortieren`}
                            title="Reihenfolge ändern (ziehen)"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1">
                            {station.callsign}
                            {dragPrefersHere && (
                              <span title="Wunsch-Station des gezogenen Controllers">
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span>{Math.round(coverage * 100)}% besetzt</span>
                            {tier1Center && (
                              <span
                                className="font-semibold text-danger-700"
                                title={`Tier-1-Position: verlangt die Freigabe ${station.callsign}, die Ebene CTR genügt nicht`}
                              >
                                · T1
                              </span>
                            )}
                            {famRequirement && (
                              <span
                                className="font-semibold"
                                title={`Sektorkenntnis nötig: ${famRequirement}`}
                              >
                                · FAM
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getBadgeClassForEndorsement(meta.group)} shrink-0 text-[10px]`}>
                        {meta.group ?? "?"}
                      </Badge>
                    </div>
                  </div>
                  <div
                    ref={registerRow("station", station.id)}
                    className={`relative shrink-0 ${
                      isDropTarget ? "bg-primary/5" : ""
                    } ${canEdit ? "cursor-crosshair" : ""}`}
                    style={{ width: timelineWidth, height: ROW_H, ...gridBackground, touchAction: "none" }}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget) startCreate(e, station.id);
                    }}
                  >
                    {/* Unbesetzte Bereiche */}
                    {uncoveredRanges(station.id).map((gap, i) => (
                      <div
                        key={i}
                        className="absolute top-1 bottom-1 rounded-sm pointer-events-none"
                        style={{
                          left: gap.start * pxPerMinute,
                          width: (gap.end - gap.start) * pxPerMinute,
                          backgroundImage:
                            "repeating-linear-gradient(45deg, rgba(239,68,68,0.06) 0 6px, transparent 6px 12px)",
                        }}
                      />
                    ))}
                    {/* Beim Controller-Drag: dessen Nichtverfügbarkeit + Belegung einblenden */}
                    {dragControllerOverlay && (
                      <>
                        {dragControllerOverlay.unavailable.map((r, i) => (
                          <div
                            key={`unav-${i}`}
                            className="absolute top-0 bottom-0 pointer-events-none z-10"
                            style={{
                              left: r.start * pxPerMinute,
                              width: (r.end - r.start) * pxPerMinute,
                              backgroundImage:
                                "repeating-linear-gradient(45deg, rgba(239,68,68,0.25) 0 4px, transparent 4px 8px)",
                            }}
                          />
                        ))}
                        {dragControllerOverlay.busy.map((r, i) => (
                          <div
                            key={`busy-${i}`}
                            className="absolute top-0 bottom-0 pointer-events-none z-10 bg-slate-500/25"
                            style={{
                              left: r.start * pxPerMinute,
                              width: (r.end - r.start) * pxPerMinute,
                            }}
                          />
                        ))}
                      </>
                    )}
                    {/* Zuweisungen */}
                    {displayAssignments
                      .filter((a) => a.stationId === station.id)
                      .map((a) => renderBlock(a, "station"))}
                    {/* Create-Vorschau */}
                    {drag?.kind === "create" && drag.stationId === station.id && (
                      <div
                        className="absolute top-1 bottom-1 rounded-md border-2 border-dashed border-primary bg-primary/15 pointer-events-none z-20"
                        style={{
                          left: drag.start * pxPerMinute,
                          width: (drag.end - drag.start) * pxPerMinute,
                        }}
                      />
                    )}
                    {/* Controller-Drop-Vorschau */}
                    {isDropTarget &&
                      drag.kind === "assign-controller" &&
                      drag.start !== null &&
                      drag.end !== null && (
                        <div
                          className={`absolute top-1 bottom-1 rounded-md border-2 border-dashed pointer-events-none z-20 flex items-center px-1.5 text-[11px] font-medium ${
                            dragValidity?.valid
                              ? dragValidity.warn
                                ? "border-amber-500 bg-amber-500/15 text-amber-700"
                                : "border-emerald-500 bg-emerald-500/15 text-emerald-700"
                              : "border-destructive bg-destructive/15 text-destructive"
                          }`}
                          style={{
                            left: drag.start * pxPerMinute,
                            width: (drag.end - drag.start) * pxPerMinute,
                          }}
                        >
                          <span className="truncate">
                            {controllerByCid.get(drag.userCID)?.name}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              );
  };

  const assignDialogStation = assignDialog ? stationById.get(assignDialog.stationId) ?? null : null;

  const statusPublished = event.status === "ROSTER_PUBLISHED";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Kopfzeile mit Zurück-Option und Aktionen */}
      <header className="border-b px-3 py-2 shrink-0 flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/events/${event.id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
        </Button>
        <div className="min-w-0 hidden md:block border-r pr-3 mr-1">
          <p className="text-sm font-semibold truncate max-w-48">{event.name}</p>
          <p className="text-xs text-muted-foreground">Besetzungsplan</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <Badge variant="outline">
            {minuteToHM(eventStart, 0)}z – {minuteToHM(eventStart, totalMinutes)}z
          </Badge>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {slotMinutes}-min
          </Badge>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {stations.length} Stat.
          </Badge>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {controllers.length} Anm.
          </Badge>
          <Badge
            variant="outline"
            className={liveConnected ? "text-emerald-600 border-emerald-300" : "text-muted-foreground"}
            title={
              liveConnected
                ? "Live verbunden – Änderungen anderer erscheinen automatisch"
                : "Live-Verbindung getrennt – wird automatisch neu aufgebaut"
            }
          >
            {liveConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          </Badge>
          {warnings.length > 0 && (
            <button onClick={() => setWarningsOpen((o) => !o)}>
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 cursor-pointer">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {warnings.length}
              </Badge>
            </button>
          )}
          {selectedIds.size > 1 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              title="Auswahl aufheben (Esc)"
              className="inline-flex items-center gap-1 rounded-full border border-accent-500/50 bg-accent-500/10 px-2 py-0.5 text-xs text-accent-600 dark:text-accent-400"
            >
              {selectedIds.size} Blöcke ausgewählt
              <X className="h-3 w-3" />
            </button>
          )}
          {statusPublished && (
            <Badge
              variant="outline"
              className={
                unpublished
                  ? "border-accent-300 text-accent-600"
                  : "border-success-300 text-success-800"
              }
              title={
                unpublished
                  ? "Der Arbeitsstand weicht von der veröffentlichten Fassung ab"
                  : "Arbeitsstand und veröffentlichte Fassung sind identisch"
              }
            >
              {unpublished ? "Unveröffentlichte Änderungen" : "Veröffentlicht"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Wer sitzt gerade mit am Plan? */}
          <PresenceBar users={presence} selfCID={selfCID} className="mr-1" />

          {/* Zoom als zusammenhängende Gruppe */}
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
              disabled={zoomIdx === 0}
              aria-label="Herauszoomen"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-l-none border-l"
              onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              aria-label="Hineinzoomen"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => void undoLast()}
              disabled={undoStack.length === 0 || undoing}
              title={
                undoStack.length === 0
                  ? "Nichts zum Rückgängigmachen"
                  : `Letzte Änderung rückgängig (${undoStack.length}) – Strg+Z`
              }
              aria-label="Letzte Änderung rückgängig machen"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}

          {canManageSignups && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSignupDialog({ signup: null })}
              title="Anmeldung hinzufügen oder bearbeiten"
            >
              <UserPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden lg:inline">Anmeldung</span>
            </Button>
          )}

          {/* Alles, was seltener gebraucht wird, liegt gebündelt im Menü –
              die Leiste soll die häufigen Handgriffe zeigen, nicht alle. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Weitere Aktionen">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSnapshotsOpen(true)}>
                <History className="h-4 w-4 mr-2" /> Snapshots
              </DropdownMenuItem>
              {(canEdit || canManageEditors) && (
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" /> Einstellungen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" /> Als CSV herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyText}>
                <Copy className="h-4 w-4 mr-2" /> Als Text kopieren
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setResetDialogOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Besetzung zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              // Nach der Erstveröffentlichung nur aktiv, wenn es auch etwas
              // zu veröffentlichen gibt.
              disabled={statusPublished && !unpublished}
              variant={statusPublished && !unpublished ? "outline" : "default"}
            >
              <Eye className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">
                {statusPublished
                  ? unpublished
                    ? "Änderungen veröffentlichen"
                    : "Veröffentlicht"
                  : "Veröffentlichen"}
              </span>
            </Button>
          )}
        </div>
      </header>

      {/* Hauptbereich: Board links, Seitenleiste rechts */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Warnungen */}
          {(warnings.length > 0 || dismissedWarnings.length > 0) && warningsOpen && (
            <div className="p-3 pb-0">
              <WarningsPanel
                warnings={warnings}
                dismissed={dismissedWarnings}
                canEdit={canEdit}
                onSelect={(id) => setSelectedId(id)}
                onDismiss={setWarningDismissed}
                onClose={() => setWarningsOpen(false)}
              />
            </div>
          )}

          {/*
            Stationen und Controller scrollen senkrecht getrennt: So bleibt der
            Blick auf die Stationen, während man unten durch die Anmeldungen
            geht – beim Besetzen schaut man ständig zwischen beidem hin und her.
            Waagerecht laufen sie dagegen im Gleichschritt, sonst zeigten die
            beiden Zeitachsen verschiedene Ausschnitte.
          */}
          <div className="flex-1 min-h-0 m-3 border rounded-xl bg-background flex flex-col overflow-hidden">
            {/* Zeit-Header */}
            <div
              ref={headerScrollRef}
              onScroll={() => syncHorizontal("header")}
              className="shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div style={{ width: labelWidth + timelineWidth, minWidth: "100%" }}>
            <div className="flex bg-background border-b">
              <div
                className="sticky left-0 z-50 bg-background border-r px-3 py-1.5 text-xs font-semibold text-muted-foreground shrink-0 flex items-end"
                style={{ width: labelWidth }}
              >
                Stationen
              </div>
              <div className="relative" style={{ width: timelineWidth, height: 28 }}>
                {slots.map((s) => (
                  <div
                    key={s.minute}
                    className={`absolute top-0 bottom-0 flex items-center text-[9px] pl-1 ${
                      s.isHour
                        ? "font-semibold text-foreground border-l border-muted-foreground/40"
                        : "text-muted-foreground border-l border-muted-foreground/15"
                    }`}
                    style={{ left: s.minute * pxPerMinute, width: pxPerSlot }}
                  >
                    {(s.isHour || slotMinutes === 30 || pxPerSlot >= 56) && `${s.label}`}
                  </div>
                ))}
              </div>
            </div>
              </div>
            </div>

            {/* Stationen: eigener Scrollbereich */}
            <div
              ref={stationScrollRef}
              onScroll={() => syncHorizontal("station")}
              className="shrink-0 overflow-auto"
              style={{ height: stationsHeight }}
            >
              <div style={{ width: labelWidth + timelineWidth, minWidth: "100%" }}>
            {/* Stationen-Board, bei mehreren Airports nach Airport gebündelt */}
            {stationGroups.map((group, groupIndex) => {
              const collapsed = group.airport !== null && collapsedAirports.has(group.airport);
              // Eine eingeklappte Gruppe verschwindet nicht spurlos: Wie viele
              // Blöcke sie enthält, bleibt sichtbar.
              const blocksInGroup = collapsed
                ? displayAssignments.filter((a) =>
                    group.stations.some((st) => st.id === a.stationId)
                  ).length
                : 0;
              return (
                <React.Fragment key={group.airport ?? "all"}>
                  {group.airport && (
                    <div className="flex border-b bg-muted/30 group/ap">
                      <div
                        className="sticky left-0 z-20 bg-muted/30 border-r pl-1 pr-3 py-1 shrink-0 flex items-center gap-1"
                        style={{ width: labelWidth }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleAirportCollapsed(group.airport!)}
                          className="flex items-center gap-1 min-w-0 rounded px-1 py-0.5 hover:bg-background/60"
                          title={collapsed ? "Gruppe ausklappen" : "Gruppe einklappen"}
                        >
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                              collapsed && "-rotate-90"
                            )}
                          />
                          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                            {group.airport}
                            <span className="ml-1.5 font-normal">
                              {group.stations.length} Stat.
                              {collapsed &&
                                blocksInGroup > 0 &&
                                ` · ${blocksInGroup} ${blocksInGroup === 1 ? "Block" : "Blöcke"}`}
                            </span>
                          </span>
                        </button>
                        {canEdit && (
                          <span className="ml-auto flex items-center opacity-0 group-hover/ap:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => moveAirportGroup(group.airport!, -1)}
                              disabled={groupIndex === 0}
                              className="rounded p-0.5 text-muted-foreground hover:bg-background/60 disabled:opacity-30"
                              title="Gruppe nach oben"
                              aria-label={`${group.airport} nach oben`}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveAirportGroup(group.airport!, 1)}
                              disabled={groupIndex === stationGroups.length - 1}
                              className="rounded p-0.5 text-muted-foreground hover:bg-background/60 disabled:opacity-30"
                              title="Gruppe nach unten"
                              aria-label={`${group.airport} nach unten`}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="shrink-0" style={{ width: timelineWidth }} />
                    </div>
                  )}
                  {!collapsed && group.stations.map(renderStationRow)}
                </React.Fragment>
              );
            })}

              </div>
            </div>

            {/* Ziehbarer Trenner zwischen den Bereichen */}
            <div
              onPointerDown={startSplitDrag}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 60 : 20;
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  setStationsHeight((h) => {
                    const next = Math.max(MIN_PANE, h + (e.key === "ArrowDown" ? step : -step));
                    window.localStorage.setItem(SPLIT_PREF_KEY, String(next));
                    return next;
                  });
                }
              }}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Aufteilung zwischen Stationen und Controllern"
              aria-valuenow={Math.round(stationsHeight)}
              tabIndex={0}
              className="group/split shrink-0 h-2 cursor-row-resize bg-muted/60 hover:bg-accent-500/30 focus-visible:bg-accent-500/40 focus-visible:outline-none transition-colors flex items-center justify-center"
              title="Aufteilung ziehen (auch mit den Pfeiltasten)"
              style={{ touchAction: "none" }}
            >
              <span className="h-0.5 w-8 rounded-full bg-muted-foreground/40 group-hover/split:bg-accent-500" />
            </div>

            {/* Controller-Kopf: bleibt stehen, während beide Seiten scrollen */}
            <div className="flex bg-muted/50 border-b shrink-0">
              <div
                className="bg-muted/50 border-r pl-3 pr-1 py-1.5 shrink-0 flex items-center"
                style={{ width: labelWidth }}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  Controller ({visibleControllers.length})
                </span>
                {/* Steht über der Spalte, die es steuert */}
                <div className="ml-auto">
                  <InfoColumnControls
                    showInfoColumn={showRemarks}
                    onToggleInfoColumn={() => setShowRemarks((v) => !v)}
                    infoFields={infoFields}
                    onToggleInfoField={toggleInfoField}
                  />
                </div>
              </div>
              <div className="px-3 py-1.5 min-w-0 flex-1 overflow-x-auto">
                <ControllerFilterBar
                  visibleCount={visibleControllers.length}
                  totalCount={controllers.length}
                  search={controllerSearch}
                  onSearchChange={setControllerSearch}
                  matchedStations={matchedStations.map((st) => st.callsign)}
                  sort={controllerSort}
                  onSortChange={setControllerSort}
                  eventAirports={event.airports}
                  airportFilter={airportFilter}
                  onAirportFilterChange={setAirportFilter}
                  stations={filterStations}
                  stationFilter={stationFilter}
                  onStationFilterChange={setStationFilter}
                  onlyUnscheduled={onlyUnscheduled}
                  onOnlyUnscheduledChange={setOnlyUnscheduled}
                  flagFilter={flagFilter}
                  flagCounts={flagCounts}
                  onToggleFlag={toggleFlagFilter}
                  hasActiveFilter={
                    stationFilter !== null ||
                    airportFilter !== null ||
                    onlyUnscheduled ||
                    flagFilter.size > 0 ||
                    controllerSearch.trim() !== ""
                  }
                  onReset={() => {
                    setStationFilter(null);
                    setAirportFilter(null);
                    setOnlyUnscheduled(false);
                    setFlagFilter(new Set());
                    setControllerSearch("");
                  }}
                />
              </div>
            </div>

            {/* Controller: eigener Scrollbereich */}
            <div
              ref={controllerScrollRef}
              onScroll={() => syncHorizontal("controller")}
              className="flex-1 min-h-0 overflow-auto"
            >
              <div style={{ width: labelWidth + timelineWidth, minWidth: "100%" }}>
            {visibleControllers.map((c) => {
              const minutes = assignedMinutes.get(c.cid) ?? 0;
              // Bei einem Airport – oder wenn auf einen eingegrenzt wurde –
              // bezieht sich das Badge auf genau diesen und zeigt dessen
              // Einschränkungen direkt darunter. Über mehrere Airports hinweg
              // wäre beides irreführend.
              const focusAirport =
                airportFilter ?? (event.airports.length === 1 ? event.airports[0] : null);
              const focusData = focusAirport
                ? c.entry.airportEndorsements?.[focusAirport]
                : undefined;
              const bestGroup = focusAirport
                ? getControllerGroupForStation(c.entry, focusAirport, event.airports)
                : getControllerGroupForStation(c.entry, null, event.airports);
              const focusRestrictions = (focusData?.restrictions ?? []).filter(Boolean);
              const isDragSource =
                drag?.kind === "assign-controller" && drag.userCID === c.cid;
              const isSelectedRow = selectedCID === c.cid;
              const mark = markByCid.get(c.cid);
              const flag = mark?.flag ?? null;
              return (
                <div
                  key={c.cid}
                  className={`flex border-b last:border-b-0 ${
                    isSelectedRow ? "bg-primary/10" : isDragSource ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`sticky left-0 z-20 border-r pr-2 shrink-0 flex items-stretch select-none ${
                      isSelectedRow ? "bg-primary/10" : "bg-background"
                    }`}
                    style={{ width: labelWidth, height: controllerRowH }}
                  >
                    {/* Ampel-Streifen: Markierung auf einen Blick über alle Zeilen */}
                    <span
                      className={cn(
                        "w-1 shrink-0",
                        flag ? ROSTER_FLAG_BAR[flag] : "bg-transparent"
                      )}
                    />
                    <div
                      className={cn(
                        "flex items-center gap-1 min-w-0 pl-1",
                        showRemarks ? "w-[218px] shrink-0" : "flex-1",
                        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                      )}
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => startAssignDrag(e, c.cid)}
                      onClick={
                        canEdit
                          ? undefined
                          : () => setSelectedCID((sel) => (sel === c.cid ? null : c.cid))
                      }
                    >
                      {canEdit && (
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate leading-tight flex items-center gap-1">
                          <span className={cn("truncate", c.withdrawn && "line-through")}>
                            {c.name}
                          </span>
                          {c.withdrawn && (
                            <span title="Anmeldung zurückgezogen">
                              <UserX className="h-3 w-3 shrink-0 text-danger-600" />
                            </span>
                          )}
                          {/* Ohne Infospalte bleiben die Symbole die Kurzform */}
                          {!showRemarks && c.preferredStations && (
                            <span title={`Wunschstationen: ${c.preferredStations}`}>
                              <Star className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />
                            </span>
                          )}
                          {!showRemarks && c.remarks && (
                            <span title={`Remarks: ${c.remarks}`}>
                              <MessageSquare className="h-3 w-3 text-sky-500 shrink-0" />
                            </span>
                          )}
                          {!showRemarks && mark?.note && (
                            <span title={`Interne Notiz: ${mark.note}`}>
                              <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight truncate">
                          {c.cid} • {c.rating}
                          {minutes > 0 ? ` • ${formatDuration(minutes)}` : " • frei"}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 max-w-24">
                        <Badge
                          className={`${getBadgeClassForEndorsement(bestGroup)} shrink-0 text-[10px]`}
                        >
                          {bestGroup ?? "?"}
                        </Badge>
                        {focusRestrictions.length > 0 && (
                          <span
                            className="text-[9px] leading-tight text-right text-danger-700 dark:text-danger-300 line-clamp-2"
                            title={focusRestrictions.join(" · ")}
                          >
                            {focusRestrictions.join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Infospalte: Wünsche, Remarks und interne Notiz */}
                    {showRemarks && (
                      <div
                        className="flex-1 min-w-0 border-l pl-2 pr-1 py-1 flex items-start gap-1 cursor-pointer"
                        onClick={() => setSelectedCID((sel) => (sel === c.cid ? null : c.cid))}
                        onDoubleClick={(e) => {
                          if (!canEdit) return;
                          e.stopPropagation();
                          setNoteDraftCID(c.cid);
                          setNoteDraft(markByCid.get(c.cid)?.note ?? "");
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setInfoMenuAt({ x: e.clientX, y: e.clientY });
                        }}
                        title={
                          canEdit
                            ? "Klicken für Details, Doppelklick für eine Notiz"
                            : "Für Details anklicken"
                        }
                      >
                        {noteDraftCID === c.cid ? (
                          // Schnellnotiz: bleibt an Ort und Stelle, damit der
                          // Blick beim Planen nicht in einen Dialog abwandert.
                          <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              autoFocus
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              onBlur={commitNoteDraft}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitNoteDraft();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setNoteDraftCID(null);
                                }
                              }}
                              placeholder="Notiz – Enter speichert, Esc bricht ab"
                              className="h-7 text-[11px]"
                              maxLength={2000}
                            />
                          </div>
                        ) : (
                        <div className="min-w-0 flex-1 space-y-0.5">
                          {/* Bei mehreren Airports zuerst, wo jemand überhaupt
                              sitzen darf – das entscheidet vor allem anderen.
                              Ist auf einen Airport eingegrenzt, stehen dessen
                              Einschränkungen schon am Badge. */}
                          {infoFields.has("airports") && !focusAirport && (
                            <AirportChips
                              entry={c.entry}
                              eventAirports={event.airports}
                              showRestrictions
                              className="mb-0.5"
                            />
                          )}
                          {infoFields.has("preferred") && c.preferredStations && (
                            <p className="text-[10px] leading-tight text-amber-700 dark:text-amber-300 truncate">
                              <Star className="inline h-2.5 w-2.5 mb-0.5 mr-0.5 fill-current" />
                              {c.preferredStations}
                            </p>
                          )}
                          {infoFields.has("remarks") && c.remarks && (
                            <p
                              className="text-[10px] leading-tight text-foreground/80 line-clamp-2"
                              title={c.remarks}
                            >
                              {c.remarks}
                            </p>
                          )}
                          {infoFields.has("note") && mark?.note && (
                            <p
                              className="text-[10px] leading-tight text-sky-700 dark:text-sky-300 line-clamp-2"
                              title={mark.note}
                            >
                              <StickyNote className="inline h-2.5 w-2.5 mb-0.5 mr-0.5" />
                              {mark.note}
                            </p>
                          )}
                          {!(infoFields.has("preferred") && c.preferredStations) &&
                            !(infoFields.has("remarks") && c.remarks) &&
                            !(infoFields.has("note") && mark?.note) &&
                            !(infoFields.has("airports") && !focusAirport) && (
                              <p className="text-[10px] leading-tight text-muted-foreground/60">
                                {canEdit
                                  ? "keine Angaben · Doppelklick für Notiz"
                                  : "keine Angaben"}
                              </p>
                            )}
                        </div>
                        )}
                        {canEdit && noteDraftCID !== c.cid && (
                          <FlagPicker
                            flag={flag}
                            onChange={(next) => saveMark(c.cid, { flag: next })}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    ref={registerRow("controller", c.cid)}
                    className="relative shrink-0"
                    style={{ width: timelineWidth, height: controllerRowH, ...gridBackground }}
                  >
                    {/* Verfügbarkeits-Hintergrund */}
                    <div
                      className={`absolute inset-0 pointer-events-none ${
                        c.hasAvailability ? "bg-emerald-500/10" : "bg-muted/40"
                      }`}
                    />
                    {c.unavailable.map((r, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-red-500/15 pointer-events-none"
                        style={{
                          left: r.start * pxPerMinute,
                          width: (r.end - r.start) * pxPerMinute,
                          backgroundImage:
                            "repeating-linear-gradient(45deg, rgba(239,68,68,0.15) 0 4px, transparent 4px 8px)",
                        }}
                        title="Nicht verfügbar"
                      />
                    ))}
                    {/* Zuweisungen des Controllers */}
                    {displayAssignments
                      .filter((a) => a.userCID === c.cid)
                      .map((a) => renderBlock(a, "controller"))}
                  </div>
                </div>
              );
            })}
            {visibleControllers.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Keine Controller gefunden.
              </div>
            )}
              </div>
            </div>
          </div>

          {canEdit && (
            <p className="text-[11px] text-muted-foreground px-3 pb-2 shrink-0 hidden md:block">
              <strong>Bedienung:</strong> Stationszeile ziehen/klicken zum Besetzen (Dialog bietet
              auch Custom-Blöcke wie Combined/Training) • Controller von unten auf eine Station
              ziehen • Blöcke verschieben & an den Rändern verlängern • Stationen am Griff
              umsortieren • Controller anklicken für Infos in der Seitenleiste •{" "}
              <kbd className="border rounded px-1">Strg</kbd>+Klick wählt mehrere Blöcke, die
              sich gemeinsam verschieben lassen •{" "}
              <kbd className="border rounded px-1">Entf</kbd> löscht die Auswahl •{" "}
              <kbd className="border rounded px-1">Strg</kbd>+
              <kbd className="border rounded px-1">Z</kbd> nimmt zurück. Zeiten UTC.
            </p>
          )}
        </div>

        {/* Immer sichtbare Seitenleiste zum ausgewählten Controller */}
        <aside className="w-80 xl:w-96 border-l shrink-0 hidden lg:block bg-muted/10">
          <ControllerSidePanel
            eventId={event.id}
            controller={selectedController}
            bestGroup={
              selectedController
                ? getControllerGroupForStation(selectedController.entry, null, event.airports)
                : null
            }
            assignedMinutes={selectedCID != null ? assignedMinutes.get(selectedCID) ?? 0 : 0}
            shiftLabels={selectedShiftLabels}
            eventStart={eventStart}
            eventAirports={event.airports}
            firCode={event.firCode}
            note={selectedCID != null ? noteFor(selectedCID) : ""}
            flag={selectedCID != null ? flagFor(selectedCID) : null}
            canEdit={canEdit}
            canManageSignups={canManageSignups}
            onClose={() => setSelectedCID(null)}
            onSaveNote={(n) =>
              selectedCID != null ? saveMark(selectedCID, { note: n }) : Promise.resolve(false)
            }
            onSetFlag={(f) => {
              if (selectedCID != null) void saveMark(selectedCID, { flag: f });
            }}
            onEditSignup={() => {
              const entry = selectedController?.entry ?? null;
              if (entry) setSignupDialog({ signup: entry });
            }}
            apiHeaders={apiHeaders}
          />
        </aside>
      </div>

      {/* Dialog: Controller für Zeitraum auswählen */}
      <AssignDialog
        open={assignDialog !== null}
        onOpenChange={(o) => !o && setAssignDialog(null)}
        station={assignDialogStation}
        stationMeta={assignDialogStation ? stationMetaFor(assignDialogStation.callsign) : null}
        start={assignDialog?.start ?? 0}
        end={assignDialog?.end ?? 0}
        eventStart={eventStart}
        eventAirports={event.airports}
        controllers={controllers}
        assignments={assignments}
        markByCid={markByCid}
        onAssign={(cid) => {
          if (assignDialog) {
            const v = validate(assignDialog.stationId, cid, assignDialog.start, assignDialog.end);
            if (!v.valid) {
              if (v.reason) toast.error(v.reason);
              return;
            }
            if (v.warn && v.reason) toast.warning(v.reason);
            createAssignment(assignDialog.stationId, assignDialog.start, assignDialog.end, {
              userCID: cid,
            });
            setSelectedCID(cid);
            setAssignDialog(null);
          }
        }}
        onCustom={(label, color) => {
          if (assignDialog) {
            const v = validate(assignDialog.stationId, null, assignDialog.start, assignDialog.end);
            if (!v.valid) {
              if (v.reason) toast.error(v.reason);
              return;
            }
            createAssignment(assignDialog.stationId, assignDialog.start, assignDialog.end, {
              label,
              color,
            });
            setAssignDialog(null);
          }
        }}
      />

      {/* Rechtsklick-Menü der Infospalte */}
      <InfoColumnContextMenu
        at={infoMenuAt}
        onClose={() => setInfoMenuAt(null)}
        showInfoColumn={showRemarks}
        onToggleInfoColumn={() => setShowRemarks((v) => !v)}
        infoFields={infoFields}
        onToggleInfoField={toggleInfoField}
      />

      {/* Dialog: Einstellungen (Raster, Stationen, Zugriff, Zeitraum) */}
      <RosterSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        eventId={event.id}
        eventAirports={event.airports}
        firCode={event.firCode}
        roster={roster}
        assignments={assignments}
        eventWindow={`${minuteToHM(eventStart, 0)}z – ${minuteToHM(eventStart, totalMinutes)}z`}
        canEdit={canEdit}
        canManageEditors={canManageEditors}
        apiHeaders={apiHeaders}
        onUpdated={onReload}
      />

      {/* Dialog: Veröffentlichen */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {statusPublished ? "Änderungen veröffentlichen?" : "Roster veröffentlichen?"}
            </DialogTitle>
            <DialogDescription>
              {statusPublished
                ? "Der aktuelle Arbeitsstand ersetzt die bisher sichtbare Fassung. Es werden keine neuen Benachrichtigungen verschickt."
                : "Das Event wird auf „Roster veröffentlicht“ gesetzt und alle angemeldeten Controller werden benachrichtigt. Danach kannst du weiter am Plan arbeiten, ohne dass Zwischenstände sichtbar werden."}
            </DialogDescription>
          </DialogHeader>
          {warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                Es gibt noch {warnings.length}{" "}
                {warnings.length === 1 ? "Planungshinweis" : "Planungshinweise"}.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? "Wird veröffentlicht…" : "Jetzt veröffentlichen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Besetzung zurücksetzen */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Besetzung zurücksetzen?</DialogTitle>
            <DialogDescription>
              Alle {assignments.length} Blöcke werden entfernt. Stationen, Notizen und
              Bearbeiter bleiben erhalten.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
            <History className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              Empfehlung: vorher einen Snapshot speichern – damit lässt sich der jetzige
              Stand jederzeit wiederherstellen.
            </AlertDescription>
          </Alert>
          {/* Die Beschriftungen sind zu lang für eine Zeile – untereinander
              bleiben sie lesbar und die Reihenfolge zeigt die Empfehlung. */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => resetRoster(true)}
              disabled={resetting}
              className="w-full justify-center"
            >
              {resetting ? "Wird zurückgesetzt…" : "Snapshot speichern & zurücksetzen"}
            </Button>
            <Button
              variant="outline"
              onClick={() => resetRoster(false)}
              disabled={resetting}
              className="w-full justify-center text-destructive"
            >
              Ohne Snapshot zurücksetzen
            </Button>
            <Button
              variant="ghost"
              onClick={() => setResetDialogOpen(false)}
              disabled={resetting}
              className="w-full justify-center"
            >
              Abbrechen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Snapshots */}
      <SnapshotsDialog
        open={snapshotsOpen}
        onOpenChange={setSnapshotsOpen}
        eventId={event.id}
        canEdit={canEdit}
        apiHeaders={apiHeaders}
        onRestored={onReload}
      />

      {/* Dialog: Anmeldung bearbeiten / hinzufügen */}
      {signupDialog && (
        <SignupEditDialog
          open={true}
          onClose={() => setSignupDialog(null)}
          event={{
            id: event.id,
            name: event.name,
            startTime: event.startTime,
            endTime: event.endTime,
            airports: event.airports,
            firCode: event.firCode,
            signupSlotMinutes: event.signupSlotMinutes,
          }}
          signup={
            signupDialog.signup
              ? {
                  id: signupDialog.signup.id,
                  userCID: signupDialog.signup.user.cid,
                  user: {
                    cid: signupDialog.signup.user.cid,
                    name: signupDialog.signup.user.name,
                    rating: signupDialog.signup.user.rating,
                  },
                  availability: signupDialog.signup.availability,
                  preferredStations: signupDialog.signup.preferredStations,
                  remarks: signupDialog.signup.remarks,
                  excludedAirports: signupDialog.signup.excludedAirports,
                  deletedAt: signupDialog.signup.deletedAt,
                }
              : null
          }
          onSaved={() => {
            setSignupDialog(null);
            onReloadAllRef.current();
          }}
          onDeleted={() => {
            setSignupDialog(null);
            onReloadAllRef.current();
          }}
        />
      )}
    </div>
  );
}
