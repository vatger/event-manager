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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Coffee,
  Download,
  Copy,
  Eye,
  GripVertical,
  History,
  MessageSquare,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  StickyNote,
  UserPlus,
  Wifi,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getBadgeClassForEndorsement, getSolidClassForStationGroup } from "@/utils/EndorsementBadge";
import type { SignupTableEntry } from "@/lib/cache/types";
import type {
  ApiRoster,
  Assignment,
  DragState,
  RosterController,
  RosterWarning,
  StationMeta,
} from "../_lib/rosterTypes";
import {
  assignedMinutesByController,
  buildControllers,
  computeWarnings,
  formatDuration,
  getControllerGroupForStation,
  hasOverlap,
  isEligible,
  isUnavailable,
  minutesBetween,
  minuteToDate,
  minuteToHM,
  resolveStationMeta,
  rosterToCsv,
  rosterToText,
  stationCoverage,
  stationOccupied,
} from "../_lib/rosterUtils";
import { AssignDialog } from "./AssignDialog";
import { StationsDialog } from "./StationsDialog";
import { ControllerSidePanel } from "./ControllerSidePanel";
import { SnapshotsDialog } from "./SnapshotsDialog";
import { EditorsDialog } from "./EditorsDialog";
import SignupEditDialog from "../../_components/SignupEditDialog";

// (ControllerInfoPopover wurde durch die immer sichtbare Seitenleiste ersetzt)

// Layout-Konstanten
const LABEL_W = 224; // Breite der linken Beschriftungsspalte
const ROW_H = 44; // Zeilenhöhe
const ZOOM_LEVELS = [28, 40, 56, 76]; // Pixel pro Slot
const DEFAULT_DURATION = 60; // Standarddauer neuer Zuweisungen (Minuten)

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

// Farbschema pro Stationsgruppe für Zuweisungsblöcke
// (kategoriale Stations-Palette aus globals.css, siehe utils/EndorsementBadge)
function blockColor(group: string | null): string {
  return getSolidClassForStationGroup(group);
}

// Custom-Blöcke (Combined, Training, …) heben sich klar von Controllern ab
const CUSTOM_BLOCK_COLOR =
  "bg-station-none border-station-none [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_6px,transparent_6px_12px)]";

export function RosterEditor({
  event,
  roster,
  signups,
  stationMetaMap,
  canEdit,
  canManageEditors,
  canManageSignups,
  onReload,
  onReloadAll,
  onEventStatusChanged,
}: RosterEditorProps) {
  const router = useRouter();
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

  // Interne Notizen pro Controller
  const noteByCid = useMemo(() => {
    const map = new Map<number, string>();
    for (const n of roster.notes ?? []) map.set(n.userCID, n.note);
    return map;
  }, [roster.notes]);

  const stationById = useMemo(
    () => new Map(stations.map((s) => [s.id, s])),
    [stations]
  );
  const stationMetaFor = useCallback(
    (callsign: string): StationMeta => resolveStationMeta(callsign, stationMetaMap),
    [stationMetaMap]
  );

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assignDialog, setAssignDialog] = useState<{
    stationId: number;
    start: number;
    end: number;
  } | null>(null);
  const [stationsDialogOpen, setStationsDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [controllerSearch, setControllerSearch] = useState("");
  const [controllerSort, setControllerSort] = useState<"name" | "assigned">("name");
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  // Ausgewählter Controller für die Seitenleiste
  const [selectedCID, setSelectedCID] = useState<number | null>(null);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [editorsOpen, setEditorsOpen] = useState(false);
  // Signup bearbeiten/hinzufügen (null = zu, {signup:null} = neu anlegen)
  const [signupDialog, setSignupDialog] = useState<{ signup: SignupTableEntry | null } | null>(null);

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
    es.onerror = () => setLiveConnected(false);
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
      opts: { userCID?: number; label?: string }
    ) => {
      const isCustom = !!opts.label;
      const tempId = tempIdRef.current--;
      const optimistic: Assignment = {
        id: tempId,
        stationId,
        type: isCustom ? "custom" : "controller",
        userCID: isCustom ? null : opts.userCID ?? null,
        label: isCustom ? opts.label ?? null : null,
        color: null,
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
      } catch (err) {
        setAssignments((prev) => prev.filter((a) => a.id !== tempId));
        toast.error(err instanceof Error ? err.message : "Block fehlgeschlagen");
      }
    },
    [event.id, eventStart, apiHeaders]
  );

  const updateAssignment = useCallback(
    async (id: number, patch: Partial<Pick<Assignment, "stationId" | "userCID" | "start" | "end">>) => {
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
      } catch (err) {
        if (previous) {
          const restore = previous;
          setAssignments((prev) => prev.map((a) => (a.id === id ? restore : a)));
        }
        toast.error(err instanceof Error ? err.message : "Änderung fehlgeschlagen");
      }
    },
    [event.id, eventStart, apiHeaders]
  );

  const deleteAssignment = useCallback(
    async (id: number) => {
      const previous = assignments;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setSelectedId((sel) => (sel === id ? null : sel));
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
      } catch (err) {
        setAssignments(previous);
        toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      }
    },
    [assignments, event.id, apiHeaders]
  );

  /** Interne Notiz zu einem Controller speichern (leer = löschen) */
  const saveNote = useCallback(
    async (userCID: number, note: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/events/${event.id}/roster/notes`, {
          method: "PUT",
          headers: apiHeaders,
          body: JSON.stringify({ userCID, note }),
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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== null) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        e.preventDefault();
        deleteAssignment(selectedId);
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, deleteAssignment, canEdit]);

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
      const meta = stationMetaFor(station.callsign);
      if (!isEligible(controller, meta, event.airports)) {
        return {
          valid: false,
          warn: false,
          reason: `${controller.name} darf ${station.callsign} nicht besetzen`,
        };
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
  const startMove = useCallback(
    (e: React.PointerEvent, assignment: Assignment) => {
      if (!canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      const dur = assignment.end - assignment.start;
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
          const deltaMin = snap((ev.clientX - g.startX) / pxPerMinute);
          const start = clamp(g.original.start + deltaMin, 0, totalMinutes - dur);
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
          if (!g.moved || !current || current.kind !== "move") {
            // Klick ohne Bewegung → Block auswählen + zugehörigen Controller in die Seitenleiste
            setSelectedId((sel) => (sel === g.original!.id ? null : g.original!.id));
            if (g.original.userCID != null) setSelectedCID(g.original.userCID);
            return;
          }
          const changed =
            current.start !== g.original.start ||
            current.stationId !== g.original.stationId ||
            current.userCID !== g.original.userCID;
          if (!changed) return;
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
            updateAssignment(g.original.id, {
              stationId: current.stationId,
              userCID: current.userCID,
              start: current.start,
              end: current.end,
            });
          }
        }
      );
    },
    [canEdit, trackPointer, snap, pxPerMinute, totalMinutes, hitTest, validate, updateAssignment, applyDrag]
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
      applyDrag({ kind: "reorder-station", stationId, overStationId: null });
      trackPointer(
        (ev) => {
          const g = gestureRef.current;
          if (!g) return;
          if (Math.abs(ev.clientY - g.startY) > 4) g.moved = true;
          const hit = hitTest(ev.clientX, ev.clientY);
          applyDrag({
            kind: "reorder-station",
            stationId,
            overStationId: hit?.kind === "station" ? hit.id : null,
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
    [canEdit, trackPointer, hitTest, applyDrag, persistStationOrder]
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
    if (
      !drag ||
      (drag.kind !== "move" && drag.kind !== "resize-start" && drag.kind !== "resize-end")
    ) {
      return assignments;
    }
    return assignments.map((a) =>
      a.id === drag.assignmentId
        ? { ...a, start: drag.start, end: drag.end, stationId: drag.stationId, userCID: drag.userCID }
        : a
    );
  }, [assignments, drag]);

  const warnings = useMemo(
    () => computeWarnings(assignments, stations, controllers, eventStart),
    [assignments, stations, controllers, eventStart]
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

  const visibleControllers = useMemo(() => {
    const q = controllerSearch.trim().toLowerCase();
    let list = controllers;
    if (q) {
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || String(c.cid).includes(q)
      );
    }
    if (controllerSort === "assigned") {
      list = [...list].sort(
        (a, b) => (assignedMinutes.get(b.cid) ?? 0) - (assignedMinutes.get(a.cid) ?? 0)
      );
    }
    return list;
  }, [controllers, controllerSearch, controllerSort, assignedMinutes]);

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

  const publish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ROSTER_PUBLISHED" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || j.error || "Veröffentlichen fehlgeschlagen");
      }
      toast.success("Roster veröffentlicht – die Teilnehmer wurden benachrichtigt");
      onEventStatusChanged("ROSTER_PUBLISHED");
      setPublishDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen");
    } finally {
      setPublishing(false);
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
    const selected = selectedId === a.id;

    let colorCls = isCustom ? CUSTOM_BLOCK_COLOR : blockColor(meta?.group ?? null);
    if (isDragTarget && dragValidity) {
      if (!dragValidity.valid) colorCls = "bg-destructive/80 border-destructive";
      else if (dragValidity.warn) colorCls = "bg-amber-500/85 border-amber-600";
    }

    const who = isCustom ? a.label ?? "Custom" : controller?.name ?? `CID ${a.userCID}`;
    const label = board === "station" ? who : station?.callsign ?? "?";

    return (
      <div
        key={`${board}-${a.id}`}
        className={`absolute top-1 bottom-1 rounded-md border text-white shadow-sm select-none overflow-hidden group ${colorCls} ${
          canEdit ? "cursor-grab active:cursor-grabbing" : ""
        } ${selected ? "ring-2 ring-offset-1 ring-primary" : ""} ${
          isDragTarget ? "opacity-90 z-30" : "z-10"
        }`}
        style={{
          left: a.start * pxPerMinute,
          width: Math.max((a.end - a.start) * pxPerMinute, 8),
          touchAction: "none",
        }}
        onPointerDown={(e) => startMove(e, a)}
        title={`${station?.callsign ?? "?"} • ${who}\n${minuteToHM(eventStart, a.start)}z – ${minuteToHM(eventStart, a.end)}z (${formatDuration(a.end - a.start)})${
          blockWarnings.length > 0 ? "\n⚠ " + blockWarnings.map((w) => w.message).join("\n⚠ ") : ""
        }`}
      >
        <div className="flex items-center gap-1 h-full px-1.5 text-[11px] font-medium">
          {blockWarnings.length > 0 && (
            <AlertTriangle className="h-3 w-3 text-yellow-200 shrink-0" />
          )}
          <span className="truncate">{label}</span>
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
            {/* Löschen */}
            {selected && (
              <button
                className="absolute right-0.5 top-0.5 rounded-full bg-black/30 hover:bg-black/60 p-0.5"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAssignment(a.id);
                }}
                aria-label="Zuweisung löschen"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </>
        )}
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
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
            disabled={zoomIdx === 0}
            aria-label="Herauszoomen"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            aria-label="Hineinzoomen"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSnapshotsOpen(true)}>
            <History className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Snapshots</span>
          </Button>
          {canManageSignups && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSignupDialog({ signup: null })}
            >
              <UserPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Anmeldung</span>
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setStationsDialogOpen(true)}>
              <Settings2 className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Stationen</span>
            </Button>
          )}
          {canManageEditors && (
            <Button variant="outline" size="sm" onClick={() => setEditorsOpen(true)}>
              <ShieldCheck className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Bearbeiter</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" /> Als CSV herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyText}>
                <Copy className="h-4 w-4 mr-2" /> Als Text kopieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && !statusPublished && (
            <Button size="sm" onClick={() => setPublishDialogOpen(true)}>
              <Eye className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Veröffentlichen</span>
            </Button>
          )}
        </div>
      </header>

      {/* Hauptbereich: Board links, Seitenleiste rechts */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Warnungen */}
          {warnings.length > 0 && warningsOpen && (
            <div className="p-3 pb-0">
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="flex items-center justify-between">
            <span>Planungshinweise</span>
            <button
              onClick={() => setWarningsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Hinweise ausblenden"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertTitle>
          <AlertDescription>
            <ul className="space-y-1 mt-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  {w.type === "long_stretch" ? (
                    <Coffee className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  )}
                  <button
                    className="text-left hover:underline"
                    onClick={() => setSelectedId(w.assignmentIds[0] ?? null)}
                  >
                    {w.message}
                  </button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
            </div>
          )}

          {/* Gemeinsamer Scroll-Container für beide Boards (füllt den Bereich) */}
          <div className="flex-1 min-h-0 overflow-auto m-3 border rounded-xl bg-background">
            <div style={{ width: LABEL_W + timelineWidth, minWidth: "100%" }}>
            {/* Zeit-Header */}
            <div className="flex sticky top-0 z-40 bg-background border-b">
              <div
                className="sticky left-0 z-50 bg-background border-r px-3 py-1.5 text-xs font-semibold text-muted-foreground shrink-0 flex items-end"
                style={{ width: LABEL_W }}
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

            {/* Stationen-Board */}
            {displayStations.map((station) => {
              const meta = stationMetaFor(station.callsign);
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
                    className={`sticky left-0 z-20 bg-background border-r pr-3 pl-1 shrink-0 flex items-center justify-between gap-1.5 ${
                      isReordering ? "ring-2 ring-inset ring-primary rounded-sm" : ""
                    }`}
                    style={{ width: LABEL_W, height: ROW_H }}
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
                        <div className="text-[10px] text-muted-foreground">
                          {Math.round(coverage * 100)}% besetzt
                        </div>
                      </div>
                    </div>
                    <Badge className={`${getBadgeClassForEndorsement(meta.group)} shrink-0 text-[10px]`}>
                      {meta.group ?? "?"}
                    </Badge>
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
            })}

            {/* Trenner + Controller-Header */}
            <div className="flex bg-muted/50 border-y">
              <div
                className="sticky left-0 z-20 bg-muted/50 border-r px-3 py-2 shrink-0"
                style={{ width: LABEL_W }}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  Controller ({visibleControllers.length})
                </span>
              </div>
              <div
                className="sticky z-20 flex items-center gap-2 px-3 py-1.5 w-fit"
                style={{ left: LABEL_W }}
              >
                <div className="relative">
                  <Input
                    value={controllerSearch}
                    onChange={(e) => setControllerSearch(e.target.value)}
                    placeholder="Suchen…"
                    className="h-7 w-44 pl-7 text-xs"
                  />
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <Select
                  value={controllerSort}
                  onValueChange={(v) => setControllerSort(v as "name" | "assigned")}
                >
                  <SelectTrigger size="sm" className="h-7 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nach Name</SelectItem>
                    <SelectItem value="assigned">Nach eingeplanter Zeit</SelectItem>
                  </SelectContent>
                </Select>
                {canEdit && (
                  <span className="text-[10px] text-muted-foreground hidden md:inline">
                    Tipp: Controller per Drag & Drop auf eine Station ziehen
                  </span>
                )}
              </div>
            </div>

            {/* Controller-Board */}
            {visibleControllers.map((c) => {
              const minutes = assignedMinutes.get(c.cid) ?? 0;
              const bestGroup = getControllerGroupForStation(c.entry, null, event.airports);
              const isDragSource =
                drag?.kind === "assign-controller" && drag.userCID === c.cid;
              const isSelectedRow = selectedCID === c.cid;
              return (
                <div
                  key={c.cid}
                  className={`flex border-b last:border-b-0 ${
                    isSelectedRow ? "bg-primary/10" : isDragSource ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`sticky left-0 z-20 border-r px-2 shrink-0 flex items-center gap-1 select-none ${
                      isSelectedRow ? "bg-primary/10" : "bg-background"
                    } ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{ width: LABEL_W, height: ROW_H, touchAction: "none" }}
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
                        <span className="truncate">{c.name}</span>
                        {c.preferredStations && (
                          <span title={`Wunschstationen: ${c.preferredStations}`}>
                            <Star className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />
                          </span>
                        )}
                        {c.remarks && (
                          <span title={`Remarks: ${c.remarks}`}>
                            <MessageSquare className="h-3 w-3 text-sky-500 shrink-0" />
                          </span>
                        )}
                        {noteByCid.has(c.cid) && (
                          <span title={`Interne Notiz: ${noteByCid.get(c.cid)}`}>
                            <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {c.cid} • {c.rating}
                        {minutes > 0 ? ` • ${formatDuration(minutes)}` : " • frei"}
                      </div>
                    </div>
                    <Badge
                      className={`${getBadgeClassForEndorsement(bestGroup)} shrink-0 text-[10px]`}
                    >
                      {bestGroup ?? "?"}
                    </Badge>
                  </div>
                  <div
                    ref={registerRow("controller", c.cid)}
                    className="relative shrink-0"
                    style={{ width: timelineWidth, height: ROW_H, ...gridBackground }}
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

          {canEdit && (
            <p className="text-[11px] text-muted-foreground px-3 pb-2 shrink-0 hidden md:block">
              <strong>Bedienung:</strong> Stationszeile ziehen/klicken zum Besetzen (Dialog bietet
              auch Custom-Blöcke wie Combined/Training) • Controller von unten auf eine Station
              ziehen • Blöcke verschieben & an den Rändern verlängern • Stationen am Griff
              umsortieren • Controller anklicken für Infos in der Seitenleiste •{" "}
              <kbd className="border rounded px-1">Entf</kbd> löscht den gewählten Block. Zeiten UTC.
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
            note={selectedCID != null ? noteByCid.get(selectedCID) ?? "" : ""}
            canEdit={canEdit}
            canManageSignups={canManageSignups}
            onClose={() => setSelectedCID(null)}
            onSaveNote={(n) => (selectedCID != null ? saveNote(selectedCID, n) : Promise.resolve(false))}
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
        onCustom={(label) => {
          if (assignDialog) {
            const v = validate(assignDialog.stationId, null, assignDialog.start, assignDialog.end);
            if (!v.valid) {
              if (v.reason) toast.error(v.reason);
              return;
            }
            createAssignment(assignDialog.stationId, assignDialog.start, assignDialog.end, { label });
            setAssignDialog(null);
          }
        }}
      />

      {/* Dialog: Stationen bearbeiten */}
      <StationsDialog
        open={stationsDialogOpen}
        onOpenChange={setStationsDialogOpen}
        eventId={event.id}
        eventAirports={event.airports}
        roster={roster}
        assignments={assignments}
        onUpdated={onReload}
      />

      {/* Dialog: Veröffentlichen */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Roster veröffentlichen?</DialogTitle>
            <DialogDescription>
              Das Event wird auf „Roster veröffentlicht“ gesetzt und alle angemeldeten
              Controller werden benachrichtigt.
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

      {/* Dialog: Snapshots */}
      <SnapshotsDialog
        open={snapshotsOpen}
        onOpenChange={setSnapshotsOpen}
        eventId={event.id}
        canEdit={canEdit}
        apiHeaders={apiHeaders}
        onRestored={onReload}
      />

      {/* Dialog: Bearbeiter verwalten */}
      {canManageEditors && (
        <EditorsDialog
          open={editorsOpen}
          onOpenChange={setEditorsOpen}
          eventId={event.id}
          apiHeaders={apiHeaders}
        />
      )}

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
