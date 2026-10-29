"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowUp,
  Ban,
  Loader2,
  Play,
  Square,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { S1TheoryBadge } from "@/components/S1TheoryBadge";
import {
  formatDuration,
  getControllerGroupForStation,
  hasExcludedAirport,
  minuteToHM,
} from "../_lib/rosterUtils";
import type { Assignment, RosterController, RosterStation, StationMeta } from "../_lib/rosterTypes";
import { parsePartners, parseWishes, type WishStation } from "@/lib/roster/solver/wishParser";
import {
  DEFAULT_SOLVER_CONFIG,
  DEFAULT_STATION_PRIORITY,
  SOLVER_MINUTES_MAX,
  SOLVER_TIME_LIMIT_MAX,
  type ApiSolverRun,
  type ControllerPreference,
  type SolverConfig,
  type StationPriority,
} from "@/lib/roster/solver/types";

interface SolverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  eventStatus: string;
  eventStart: Date;
  totalMinutes: number;
  eventAirports: string[];
  stations: RosterStation[];
  assignments: Assignment[];
  controllers: RosterController[];
  stationMetaFor: (callsign: string) => StationMeta;
  canEdit: boolean;
  apiHeaders: Record<string, string>;
  /** Nach dem Übernehmen: Plan neu laden */
  onApplied: () => void;
}

type PrefDraft = Omit<ControllerPreference, "userCID">;

const EMPTY_PREF: PrefDraft = {
  preferredStations: [],
  avoidedStations: [],
  maxTotalMinutes: null,
  excludeFromSolver: false,
  partnerCids: [],
};

const PRIORITY_LABEL: Record<StationPriority, string> = {
  0: "Aus",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Wartet",
  running: "Rechnet",
  done: "Fertig",
  failed: "Fehlgeschlagen",
  cancelled: "Abgebrochen",
  applied: "Übernommen",
};

/** Wünsche aus der API-Antwort nach CID */
function toPrefMap(list: ControllerPreference[] | undefined): Map<number, PrefDraft> {
  const map = new Map<number, PrefDraft>();
  for (const { userCID, ...rest } of list ?? []) map.set(userCID, rest);
  return map;
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function samePref(a: PrefDraft, b: PrefDraft) {
  return (
    sameList(a.partnerCids.map(String), b.partnerCids.map(String)) &&
    sameList(a.preferredStations, b.preferredStations) &&
    sameList(a.avoidedStations, b.avoidedStations) &&
    a.maxTotalMinutes === b.maxTotalMinutes &&
    a.excludeFromSolver === b.excludeFromSolver
  );
}

/**
 * Automatische Planung: Wünsche strukturieren, Regeln festlegen, im
 * Hintergrund rechnen lassen und den Vorschlag prüfen und übernehmen.
 */
export function SolverDialog({
  open,
  onOpenChange,
  eventId,
  eventStatus,
  eventStart,
  totalMinutes,
  eventAirports,
  stations,
  assignments,
  controllers,
  stationMetaFor,
  canEdit,
  apiHeaders,
  onApplied,
}: SolverDialogProps) {
  const [tab, setTab] = useState("wishes");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Map<number, PrefDraft>>(new Map());
  const [drafts, setDrafts] = useState<Map<number, PrefDraft>>(new Map());
  const [config, setConfig] = useState<SolverConfig>(DEFAULT_SOLVER_CONFIG);
  const [savedConfig, setSavedConfig] = useState<SolverConfig>(DEFAULT_SOLVER_CONFIG);
  const [runs, setRuns] = useState<ApiSolverRun[]>([]);
  const [currentRun, setCurrentRun] = useState<ApiSolverRun | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");

  const base = `/api/events/${eventId}/roster`;
  const active = useMemo(() => controllers.filter((c) => !c.withdrawn), [controllers]);
  const callsigns = useMemo(() => stations.map((s) => s.callsign), [stations]);
  const nameByCid = useMemo(() => new Map(controllers.map((c) => [c.cid, c.name])), [controllers]);

  const wishStations: WishStation[] = useMemo(
    () =>
      stations.map((s) => {
        const meta = stationMetaFor(s.callsign);
        return {
          callsign: s.callsign,
          group: meta.group,
          airport: meta.airport,
          abbreviation: meta.abbreviation ?? null,
          description: meta.description ?? null,
        };
      }),
    [stations, stationMetaFor]
  );

  // ------------------------------------------------------------------
  // Laden
  // ------------------------------------------------------------------
  const loadRun = useCallback(
    async (runId: number) => {
      // Netzwerkfehler wie ein fehlgeschlagener Abruf behandeln
      try {
        const res = await fetch(`${base}/solver/runs/${runId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.run as ApiSolverRun;
      } catch {
        return null;
      }
    },
    [base]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefRes, solverRes] = await Promise.all([
        fetch(`${base}/preferences`),
        fetch(`${base}/solver`),
      ]);
      if (prefRes.ok) {
        const data = await prefRes.json();
        const map = toPrefMap(data.preferences);
        setSaved(map);
        setDrafts(new Map(map));
      }
      if (solverRes.ok) {
        const data = await solverRes.json();
        setConfig(data.config);
        setSavedConfig(data.config);
        const list = (data.runs ?? []) as ApiSolverRun[];
        setRuns(list);
        // Den jüngsten Lauf mit Ergebnis (oder den laufenden) direkt zeigen
        const latest = list[0];
        if (latest) setCurrentRun(await loadRun(latest.id));
        else setCurrentRun(null);
      }
    } catch {
      toast.error("Die automatische Planung konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [base, loadRun]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Laufenden Lauf abfragen, bis er fertig ist
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Zählt fehlgeschlagene Abfragen je Lauf – jede löst die nächste aus, damit
  // ein einzelner Aussetzer die Abfrage nicht dauerhaft beendet. Ein neuer
  // Lauf beginnt wieder ohne Wartezeit.
  const [pollFailures, setPollFailures] = useState<{ runId: number; count: number } | null>(null);
  const failures = currentRun && pollFailures?.runId === currentRun.id ? pollFailures.count : 0;
  useEffect(() => {
    if (!open || !currentRun) return;
    if (currentRun.status !== "queued" && currentRun.status !== "running") return;
    const delay = failures === 0 ? 1500 : Math.min(15000, 1500 * 2 ** failures);
    // Wechselt die Ansicht zu einem anderen Lauf, während die Abfrage noch
    // unterwegs ist, darf ihre Antwort die Ansicht nicht zurückholen
    let cancelled = false;
    pollRef.current = setTimeout(async () => {
      const next = await loadRun(currentRun.id);
      if (cancelled) return;
      if (!next) {
        setPollFailures({ runId: currentRun.id, count: failures + 1 });
        return;
      }
      setPollFailures(null);
      setCurrentRun(next);
      setRuns((list) => list.map((r) => (r.id === next.id ? { ...next, result: null } : r)));
      if (next.status === "done") toast.success("Die automatische Planung ist fertig");
      if (next.status === "failed") toast.error(next.error ?? "Die Planung ist fehlgeschlagen");
    }, delay);
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [open, currentRun, loadRun, failures]);

  // Lauf aus der Liste zeigen – bei schnellem Umschalten gilt der zuletzt gewählte
  const selectedRunRef = useRef<number | null>(null);
  const showRun = async (runId: number) => {
    selectedRunRef.current = runId;
    const run = await loadRun(runId);
    if (selectedRunRef.current === runId) setCurrentRun(run);
  };

  // ------------------------------------------------------------------
  // Wünsche
  // ------------------------------------------------------------------
  const prefFor = (cid: number): PrefDraft => drafts.get(cid) ?? EMPTY_PREF;
  const updatePref = (cid: number, patch: Partial<PrefDraft>) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.set(cid, { ...(prev.get(cid) ?? EMPTY_PREF), ...patch });
      return next;
    });
  };
  const dirtyCids = useMemo(
    () =>
      active
        .map((c) => c.cid)
        .filter((cid) => !samePref(drafts.get(cid) ?? EMPTY_PREF, saved.get(cid) ?? EMPTY_PREF)),
    [active, drafts, saved]
  );

  const suggestFromText = () => {
    let count = 0;
    const next = new Map(drafts);
    const people = active.map((c) => ({ cid: c.cid, name: c.name }));
    for (const c of active) {
      const current = drafts.get(c.cid) ?? EMPTY_PREF;
      // Bemerkungen nach den Wünschen: „bitte kein DEL“ steht oft dort
      const text = [c.preferredStations, c.remarks].filter(Boolean).join("\n");
      const patch: Partial<PrefDraft> = {};
      // Bereits gepflegte Einträge bleiben unangetastet
      if (current.preferredStations.length === 0 && current.avoidedStations.length === 0) {
        const own = wishStations.filter((st) => !st.airport || !hasExcludedAirport(c.entry, st.airport));
        const parsed = parseWishes(text, own);
        if (parsed.preferredStations.length > 0 || parsed.avoidedStations.length > 0) {
          Object.assign(patch, parsed);
        }
      }
      if (current.partnerCids.length === 0) {
        const partners = parsePartners(text, people, c.cid);
        if (partners.length > 0) patch.partnerCids = partners;
      }
      if (Object.keys(patch).length === 0) continue;
      next.set(c.cid, { ...current, ...patch });
      count++;
    }
    setDrafts(next);
    toast.info(
      count > 0
        ? `Vorschläge für ${count} Controller eingetragen – bitte prüfen und speichern`
        : "Im Freitext wurden keine weiteren Stationen oder Namen erkannt"
    );
  };

  const savePreferences = async (): Promise<boolean> => {
    if (dirtyCids.length === 0) return true;
    setSaving(true);
    try {
      const res = await fetch(`${base}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...apiHeaders },
        body: JSON.stringify({
          preferences: dirtyCids.map((cid) => ({ userCID: cid, ...prefFor(cid) })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Wünsche konnten nicht gespeichert werden");
        return false;
      }
      const data = await res.json();
      const map = toPrefMap(data.preferences);
      setSaved(map);
      setDrafts(new Map(map));
      toast.success("Wünsche gespeichert");
      return true;
    } catch {
      toast.error("Wünsche konnten nicht gespeichert werden – keine Verbindung zum Server");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Regeln + Start
  // ------------------------------------------------------------------
  const configDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const setCfg = (patch: Partial<SolverConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const priorityOf = (callsign: string): StationPriority =>
    config.stationPriorities[callsign] ?? DEFAULT_STATION_PRIORITY;

  const saveConfig = async (): Promise<boolean> => {
    if (!configDirty) return true;
    setSaving(true);
    try {
      // Nur Prioritäten von Stationen, die es im Plan noch gibt
      const stationPriorities = Object.fromEntries(
        Object.entries(config.stationPriorities).filter(([cs]) => callsigns.includes(cs))
      );
      const res = await fetch(`${base}/solver`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...apiHeaders },
        body: JSON.stringify({ ...config, stationPriorities }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Einstellungen konnten nicht gespeichert werden");
        return false;
      }
      setConfig(data.config);
      setSavedConfig(data.config);
      return true;
    } catch {
      toast.error("Einstellungen konnten nicht gespeichert werden – keine Verbindung zum Server");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startRun = async () => {
    setStarting(true);
    try {
      if (!(await savePreferences())) return;
      if (!(await saveConfig())) return;
      const res = await fetch(`${base}/solver`, { method: "POST", headers: apiHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Die Planung konnte nicht gestartet werden");
        return;
      }
      setCurrentRun(data.run);
      setRuns((list) => [data.run, ...list].slice(0, 10));
      setTab("result");
    } catch {
      toast.error("Die Planung konnte nicht gestartet werden – keine Verbindung zum Server");
    } finally {
      setStarting(false);
    }
  };

  const cancelRun = async () => {
    if (!currentRun) return;
    try {
      await fetch(`${base}/solver/runs/${currentRun.id}`, { method: "DELETE", headers: apiHeaders });
    } catch {
      toast.error("Abbrechen fehlgeschlagen – keine Verbindung zum Server");
    }
    const next = await loadRun(currentRun.id);
    if (next) setCurrentRun(next);
  };

  const applyRun = async () => {
    if (!currentRun) return;
    setApplying(true);
    try {
      const res = await fetch(`${base}/solver/runs/${currentRun.id}/apply`, {
        method: "POST",
        headers: apiHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Der Vorschlag konnte nicht übernommen werden");
        return;
      }
      toast.success(
        `${data.created} ${data.created === 1 ? "Schicht" : "Schichten"} eingeplant` +
          (data.removed > 0 ? `, ${data.removed} bisherige ersetzt` : "") +
          (data.keptEdited > 0 ? `, ${data.keptEdited} seit dem Lauf bearbeitete behalten` : "") +
          (data.skipped > 0 ? `, ${data.skipped} wegen Konflikten ausgelassen` : "") +
          ". Der vorige Stand liegt als Snapshot bereit."
      );
      setApplyOpen(false);
      onApplied();
      onOpenChange(false);
    } catch {
      // Ohne Antwort ist offen, ob die Übernahme durchging – nachsehen statt raten
      const next = await loadRun(currentRun.id);
      if (next?.status === "applied") {
        toast.success("Der Vorschlag wurde übernommen. Der vorige Stand liegt als Snapshot bereit.");
        setApplyOpen(false);
        onApplied();
        onOpenChange(false);
      } else {
        if (next) setCurrentRun(next);
        // Doppelt übernehmen geht nicht (der Server lehnt es ab) – erneut versuchen ist sicher
        toast.error("Keine Antwort vom Server. Bitte erneut versuchen.");
      }
    } finally {
      setApplying(false);
    }
  };

  const busy = currentRun?.status === "queued" || currentRun?.status === "running";
  // Spiegel der Server-Prüfung (supersededReason in apply.ts): Nur der jüngste
  // Vorschlag, und nur, wenn seit seinem Start keiner übernommen wurde
  const superseded =
    !!currentRun?.staleReason ||
    (!!currentRun &&
    runs.some(
      (r) =>
        r.id !== currentRun.id &&
        ((r.id > currentRun.id && (r.status === "done" || r.status === "applied")) ||
          (r.status === "applied" && !!r.appliedAt && r.appliedAt >= currentRun.createdAt))
    ));

  // ------------------------------------------------------------------
  // Darstellung
  // ------------------------------------------------------------------
  const filtered = active.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || String(c.cid).includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" /> Automatische Planung
          </DialogTitle>
          <DialogDescription>
            Wünsche der Controller festhalten, Regeln einstellen und einen Vorschlag
            berechnen lassen. Übernommen wird erst nach Prüfung.
          </DialogDescription>
        </DialogHeader>

        {eventStatus === "SIGNUP_OPEN" && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Die Anmeldung ist noch offen – spätere Anmeldungen und Änderungen fehlen
              im Vorschlag.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="wishes" className="flex-1">
                Wünsche{dirtyCids.length > 0 ? ` (${dirtyCids.length} ungespeichert)` : ""}
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex-1">
                Regeln{configDirty ? " (ungespeichert)" : ""}
              </TabsTrigger>
              <TabsTrigger value="result" className="flex-1">
                Ergebnis
              </TabsTrigger>
            </TabsList>

            {/* ---------------- Wünsche ---------------- */}
            <TabsContent value="wishes" className="flex-1 min-h-0 flex flex-col gap-2 mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name oder CID"
                  className="h-8 w-56"
                />
                <div className="flex-1" />
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" onClick={suggestFromText}>
                      Aus Freitext vorschlagen
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void savePreferences()}
                      disabled={saving || dirtyCids.length === 0}
                    >
                      Speichern
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Wunschstationen in Rangfolge (oben = am liebsten). „Will nicht“ ist eine harte
                Grenze. „Zusammen mit“ plant beide möglichst gleichzeitig auf benachbarten
                Stationen. Der Vorschlag aus dem Freitext überschreibt keine gepflegten Einträge.
              </p>

              <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b z-10">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="p-2 font-medium w-48">Controller</th>
                      <th className="p-2 font-medium">Angabe in der Anmeldung</th>
                      <th className="p-2 font-medium w-64">Wunschstationen</th>
                      <th className="p-2 font-medium w-52">Will nicht</th>
                      <th className="p-2 font-medium w-48">Zusammen mit</th>
                      <th className="p-2 font-medium w-24">Max. Std.</th>
                      <th className="p-2 font-medium w-20">Planen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const pref = prefFor(c.cid);
                      const dirty = dirtyCids.includes(c.cid);
                      const group = getControllerGroupForStation(c.entry, null, eventAirports);
                      return (
                        <tr
                          key={c.cid}
                          className={cn(
                            "border-b last:border-b-0 align-top",
                            dirty && "bg-amber-50 dark:bg-amber-950/30",
                            pref.excludeFromSolver && "opacity-60"
                          )}
                        >
                          <td className="p-2">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="font-medium truncate">{c.name}</span>
                              {c.entry.s1TheoryOnly && <S1TheoryBadge compact />}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              {c.cid} • {c.rating}
                              <Badge className={cn(getBadgeClassForEndorsement(group), "text-[10px] px-1 py-0")}>
                                {group ?? "?"}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-2 text-xs">
                            {c.preferredStations ? (
                              <p className="whitespace-pre-wrap break-words">{c.preferredStations}</p>
                            ) : (
                              <p className="text-muted-foreground">–</p>
                            )}
                            {c.remarks && (
                              <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words">
                                {c.remarks}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <StationList
                              items={pref.preferredStations}
                              ranked
                              canEdit={canEdit}
                              onChange={(list) => updatePref(c.cid, { preferredStations: list })}
                            />
                            {canEdit && (
                              <StationAdd
                                options={callsigns.filter(
                                  (cs) =>
                                    !pref.preferredStations.includes(cs) &&
                                    !pref.avoidedStations.includes(cs)
                                )}
                                label="+ Wunsch"
                                onAdd={(cs) =>
                                  updatePref(c.cid, {
                                    preferredStations: [...pref.preferredStations, cs],
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="p-2">
                            <StationList
                              items={pref.avoidedStations}
                              canEdit={canEdit}
                              tone="avoid"
                              onChange={(list) => updatePref(c.cid, { avoidedStations: list })}
                            />
                            {canEdit && (
                              <StationAdd
                                options={callsigns.filter(
                                  (cs) =>
                                    !pref.avoidedStations.includes(cs) &&
                                    !pref.preferredStations.includes(cs)
                                )}
                                label="+ Will nicht"
                                onAdd={(cs) =>
                                  updatePref(c.cid, {
                                    avoidedStations: [...pref.avoidedStations, cs],
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="p-2">
                            <PartnerList
                              cids={pref.partnerCids}
                              nameOf={(cid) => nameByCid.get(cid) ?? String(cid)}
                              canEdit={canEdit}
                              onChange={(list) => updatePref(c.cid, { partnerCids: list })}
                            />
                            {canEdit && pref.partnerCids.length < 10 && (
                              <PartnerAdd
                                options={active.filter(
                                  (o) => o.cid !== c.cid && !pref.partnerCids.includes(o.cid)
                                )}
                                onAdd={(cid) =>
                                  updatePref(c.cid, { partnerCids: [...pref.partnerCids, cid] })
                                }
                              />
                            )}
                          </td>
                          <td className="p-2">
                            {/* Dieselben Grenzen wie der Server (15 Minuten bis 24 Stunden) */}
                            <DraftNumberInput
                              min={15}
                              max={1440}
                              scale={60}
                              nullable
                              // Schrittweite ab dem Minimum (0,25 h) – 0,5 ergäbe 0,25/0,75/1,25 …
                              step={0.25}
                              disabled={!canEdit}
                              className="h-7 w-20 text-xs"
                              placeholder="–"
                              value={pref.maxTotalMinutes}
                              onChange={(v) => updatePref(c.cid, { maxTotalMinutes: v })}
                            />
                          </td>
                          <td className="p-2">
                            <Switch
                              checked={!pref.excludeFromSolver}
                              disabled={!canEdit}
                              onCheckedChange={(v) => updatePref(c.cid, { excludeFromSolver: !v })}
                              title="Aus = wird nicht automatisch eingeplant"
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-muted-foreground">
                          Keine Anmeldungen gefunden
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ---------------- Regeln ---------------- */}
            <TabsContent value="rules" className="flex-1 min-h-0 overflow-y-auto mt-3">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Schichten und Pausen</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <MinutesField
                      label="Kürzeste Schicht"
                      max={SOLVER_MINUTES_MAX.minSessionMinutes}
                      value={config.minSessionMinutes}
                      disabled={!canEdit}
                      onChange={(v) => setCfg({ minSessionMinutes: v ?? 15 })}
                    />
                    <MinutesField
                      label="Längste Schicht"
                      max={SOLVER_MINUTES_MAX.maxSessionMinutes}
                      value={config.maxSessionMinutes}
                      disabled={!canEdit}
                      onChange={(v) => setCfg({ maxSessionMinutes: v ?? 15 })}
                    />
                    <MinutesField
                      label="Angestrebte Schichtlänge"
                      max={SOLVER_MINUTES_MAX.preferredSessionMinutes}
                      value={config.preferredSessionMinutes}
                      disabled={!canEdit}
                      onChange={(v) => setCfg({ preferredSessionMinutes: v ?? 15 })}
                    />
                    <div />
                    <MinutesField
                      label="Kürzeste Pause"
                      max={SOLVER_MINUTES_MAX.minBreakMinutes}
                      value={config.minBreakMinutes}
                      disabled={!canEdit}
                      allowZero
                      onChange={(v) => setCfg({ minBreakMinutes: v ?? 0 })}
                    />
                    <MinutesField
                      label="Längste Pause"
                      hint="leer = egal"
                      value={config.maxBreakMinutes}
                      disabled={!canEdit}
                      nullable
                      onChange={(v) => setCfg({ maxBreakMinutes: v })}
                    />
                    <MinutesField
                      label="Höchstens je Person"
                      hint="leer = egal"
                      value={config.maxTotalMinutes}
                      disabled={!canEdit}
                      nullable
                      onChange={(v) => setCfg({ maxTotalMinutes: v })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Angaben in Minuten, gerundet auf das Raster des Plans. Kürzeste/längste
                    Schicht, kürzeste Pause und Höchstzeit werden immer eingehalten; die
                    angestrebte Länge und die längste Pause sind Ziele.
                  </p>

                  <h3 className="text-sm font-semibold pt-2">Gewichtung</h3>
                  <WeightField
                    label="Wünsche der Controller"
                    value={config.preferenceWeight}
                    disabled={!canEdit}
                    onChange={(v) => setCfg({ preferenceWeight: v })}
                  />
                  <WeightField
                    label="Gleichmäßige Verteilung der Zeit"
                    value={config.fairnessWeight}
                    disabled={!canEdit}
                    onChange={(v) => setCfg({ fairnessWeight: v })}
                  />

                  <h3 className="text-sm font-semibold pt-2">Ablauf</h3>
                  <ToggleField
                    label="Bestehende Schichten behalten"
                    description="Aus: Controller-Schichten werden neu geplant. Custom- und persönliche Blöcke bleiben immer."
                    checked={config.keepExisting}
                    disabled={!canEdit}
                    onChange={(v) => setCfg({ keepExisting: v })}
                  />
                  <ToggleField
                    label="Nur auf Wunschstationen"
                    description="Wer Wünsche angegeben hat, wird ausschließlich dort eingeplant."
                    checked={config.onlyPreferredStations}
                    disabled={!canEdit}
                    onChange={(v) => setCfg({ onlyPreferredStations: v })}
                  />
                  <ToggleField
                    label="Keine C1 auf S1-Stationen"
                    description="C1 und höher kommen nicht auf Stationen, die schon S1 besetzen dürfen: S1-Tower sowie DEL/GND außerhalb von Tier 1. Dort bleibt es lieber leer."
                    checked={config.keepC1OffS1Stations}
                    disabled={!canEdit}
                    onChange={(v) => setCfg({ keepC1OffS1Stations: v })}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">Rechenzeit: {config.timeLimitSeconds} s</Label>
                    <Slider
                      min={5}
                      max={SOLVER_TIME_LIMIT_MAX}
                      step={5}
                      disabled={!canEdit}
                      value={[config.timeLimitSeconds]}
                      onValueChange={([v]) => setCfg({ timeLimitSeconds: v })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Priorität der Stationen</h3>
                  <p className="text-xs text-muted-foreground">
                    1 ist die wichtigste Stufe, 5 die unwichtigste: Stationen mit Priorität 1
                    werden vollständig besetzt, bevor 2 an die Reihe kommt, und so weiter. „Aus“
                    lässt die Station für die Handplanung frei.
                  </p>
                  <div className="border rounded-md divide-y">
                    {stations.map((s) => {
                      const meta = stationMetaFor(s.callsign);
                      const p = priorityOf(s.callsign);
                      return (
                        <div key={s.id} className="flex items-center gap-2 px-2 py-1.5">
                          <span className="font-mono text-xs flex-1 truncate">{s.callsign}</span>
                          {meta.group && (
                            <Badge className={cn(getBadgeClassForEndorsement(meta.group), "text-[10px]")}>
                              {meta.group}
                            </Badge>
                          )}
                          <div className="flex rounded-md border overflow-hidden">
                            {([1, 2, 3, 4, 5, 0] as StationPriority[]).map((v) => (
                              <button
                                key={v}
                                type="button"
                                disabled={!canEdit}
                                onClick={() =>
                                  setCfg({
                                    stationPriorities: { ...config.stationPriorities, [s.callsign]: v },
                                  })
                                }
                                className={cn(
                                  "h-6 min-w-7 px-1.5 text-xs border-l first:border-l-0",
                                  p === v
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted text-muted-foreground"
                                )}
                              >
                                {PRIORITY_LABEL[v]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => void saveConfig()}
                    disabled={saving || !configDirty}
                  >
                    Speichern
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ---------------- Ergebnis ---------------- */}
            <TabsContent value="result" className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-4">
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {busy ? (
                    <Button variant="outline" onClick={() => void cancelRun()}>
                      <Square className="h-4 w-4 mr-1.5" /> Abbrechen
                    </Button>
                  ) : (
                    <Button onClick={() => void startRun()} disabled={starting || saving}>
                      {starting ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-1.5" />
                      )}
                      Planung starten
                    </Button>
                  )}
                  {(dirtyCids.length > 0 || configDirty) && !busy && (
                    <span className="text-xs text-muted-foreground">
                      Ungespeicherte Wünsche und Regeln werden beim Start gespeichert.
                    </span>
                  )}
                  <div className="flex-1" />
                  {currentRun?.status === "done" && currentRun.result && !superseded && (
                    <Button onClick={() => setApplyOpen(true)}>Vorschlag übernehmen</Button>
                  )}
                  {currentRun?.status === "done" && superseded && (
                    <span className="text-xs text-muted-foreground">
                      Veraltet: {currentRun.staleReason ?? "Ein neuerer Vorschlag liegt vor oder wurde übernommen."}
                    </span>
                  )}
                </div>
              )}

              {!currentRun && (
                <p className="text-sm text-muted-foreground">
                  Noch kein Lauf. Die Planung rechnet im Hintergrund – der Dialog darf
                  geschlossen werden, das Ergebnis bleibt hier abrufbar.
                </p>
              )}

              {currentRun && busy && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {currentRun.status === "queued"
                      ? "Wartet auf einen freien Rechenplatz …"
                      : `Rechnet … ${currentRun.progress} %`}
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-500"
                      style={{ width: `${currentRun.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Der Dialog darf geschlossen werden; die Planung läuft auf dem Server weiter.
                  </p>
                </div>
              )}

              {currentRun?.status === "failed" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{currentRun.error ?? "Die Planung ist fehlgeschlagen"}</AlertDescription>
                </Alert>
              )}
              {currentRun?.status === "cancelled" && (
                <p className="text-sm text-muted-foreground">Der Lauf wurde abgebrochen.</p>
              )}

              {currentRun?.result &&
                (currentRun.status === "done" || currentRun.status === "applied") && (
                  <ResultView
                    run={currentRun}
                    stations={stations}
                    assignments={assignments}
                    controllers={controllers}
                    eventStart={eventStart}
                    totalMinutes={totalMinutes}
                  />
                )}

              {runs.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Letzte Läufe</h3>
                  <div className="border rounded-md divide-y text-xs">
                    {runs.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => void showRun(r.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-1.5 text-left hover:bg-muted",
                          currentRun?.id === r.id && "bg-muted"
                        )}
                      >
                        <span className="font-mono">#{r.id}</span>
                        <span className="w-24">{STATUS_LABEL[r.status] ?? r.status}</span>
                        <span className="text-muted-foreground flex-1">
                          {new Date(r.createdAt).toLocaleString("de-DE")}
                          {r.createdByName ? ` • ${r.createdByName}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <AlertDialog open={applyOpen} onOpenChange={setApplyOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vorschlag übernehmen?</AlertDialogTitle>
              <AlertDialogDescription>
                {currentRun?.result?.replacesExisting
                  ? `Die ${currentRun.result.removedAssignmentIds.length} bisherigen Controller-Schichten werden ersetzt. `
                  : "Die bestehenden Schichten bleiben, der Vorschlag füllt die Lücken. "}
                Der aktuelle Stand wird vorher als Snapshot gesichert. Schichten, die
                inzwischen mit Änderungen anderer kollidieren, werden ausgelassen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={applying}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                disabled={applying}
                onClick={(e) => {
                  e.preventDefault();
                  void applyRun();
                }}
              >
                {applying && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Übernehmen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================================
// Bausteine
// =====================================================================

function StationList({
  items,
  ranked = false,
  canEdit,
  tone = "wish",
  onChange,
}: {
  items: string[];
  ranked?: boolean;
  canEdit: boolean;
  tone?: "wish" | "avoid";
  onChange: (list: string[]) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ol className="space-y-0.5 mb-1">
      {items.map((cs, i) => (
        <li
          key={cs}
          className={cn(
            "flex items-center gap-1 rounded border px-1 py-0.5 text-xs font-mono",
            tone === "avoid"
              ? "border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-200"
              : "bg-muted/40"
          )}
        >
          {ranked ? (
            <span className="w-4 text-muted-foreground">{i + 1}.</span>
          ) : (
            <Ban className="h-3 w-3 shrink-0" />
          )}
          {ranked && i === 0 && <Star className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />}
          <span className="flex-1 truncate">{cs}</span>
          {canEdit && ranked && i > 0 && (
            <button
              type="button"
              title="Weiter nach oben"
              onClick={() => {
                const next = [...items];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              title="Entfernen"
              onClick={() => onChange(items.filter((x) => x !== cs))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function PartnerList({
  cids,
  nameOf,
  canEdit,
  onChange,
}: {
  cids: number[];
  nameOf: (cid: number) => string;
  canEdit: boolean;
  onChange: (list: number[]) => void;
}) {
  if (cids.length === 0) return null;
  return (
    <ul className="space-y-0.5 mb-1">
      {cids.map((cid) => (
        <li key={cid} className="flex items-center gap-1 rounded border bg-muted/40 px-1 py-0.5 text-xs">
          <span className="flex-1 truncate">{nameOf(cid)}</span>
          {canEdit && (
            <button
              type="button"
              title="Entfernen"
              onClick={() => onChange(cids.filter((x) => x !== cid))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PartnerAdd({
  options,
  onAdd,
}: {
  options: { cid: number; name: string }[];
  onAdd: (cid: number) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      className="h-7 w-full rounded-md border bg-background px-1 text-xs text-muted-foreground"
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(Number(e.target.value));
      }}
    >
      <option value="">+ Person</option>
      {[...options]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((o) => (
          <option key={o.cid} value={o.cid}>
            {o.name}
          </option>
        ))}
    </select>
  );
}

function StationAdd({
  options,
  label,
  onAdd,
}: {
  options: string[];
  label: string;
  onAdd: (callsign: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      className="h-7 w-full rounded-md border bg-background px-1 text-xs text-muted-foreground"
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
    >
      <option value="">{label}</option>
      {options.map((cs) => (
        <option key={cs} value={cs}>
          {cs}
        </option>
      ))}
    </select>
  );
}

function MinutesField({
  label,
  hint,
  value,
  disabled,
  nullable = false,
  allowZero = false,
  max = 1440,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  disabled: boolean;
  nullable?: boolean;
  allowZero?: boolean;
  /** Obergrenze wie in solverConfigSchema */
  max?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {hint && <span className="text-muted-foreground font-normal"> ({hint})</span>}
      </Label>
      <DraftNumberInput
        min={allowZero ? 0 : 15}
        max={max}
        nullable={nullable}
        step={15}
        disabled={disabled}
        className="h-8"
        value={value}
        placeholder={nullable ? "–" : undefined}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * Zahleneingabe, die beim Tippen nicht dazwischenfunkt: Werte innerhalb der
 * Grenzen gelten sofort, Grenzen und ein leeres Feld greifen erst beim
 * Verlassen. Sonst würde aus „9“ (auf dem Weg zu 90) sofort 15 und dann 150.
 * `scale` rechnet die Anzeige um (z. B. Stunden bei gespeicherten Minuten).
 */
function DraftNumberInput({
  value,
  min,
  max,
  scale = 1,
  nullable,
  step,
  disabled,
  className,
  placeholder,
  onChange,
}: {
  value: number | null;
  min: number;
  max: number;
  scale?: number;
  nullable: boolean;
  step: number;
  disabled: boolean;
  className?: string;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (raw: string) => Math.round(Number(raw) * scale);
  return (
    <Input
      type="number"
      min={min / scale}
      max={max / scale}
      step={step}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      value={draft ?? (value != null ? value / scale : "")}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = parse(raw);
        if (raw !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        if (draft === null) return;
        setDraft(null);
        // Leer: löschen, wo das geht – sonst bleibt der bisherige Wert
        if (draft === "") {
          if (nullable) onChange(null);
          return;
        }
        // Halbe Eingaben („-“, „e“) ergeben NaN – dann bleibt der bisherige Wert
        const n = parse(draft);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
}

function WeightField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const words = ["egal", "gering", "gering", "mittel", "mittel", "mittel", "hoch", "hoch", "hoch", "sehr hoch", "sehr hoch"];
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}: <span className="font-normal">{words[Math.round(value)]}</span>
      </Label>
      <Slider
        min={0}
        max={10}
        step={1}
        disabled={disabled}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Kennzahlen und Vorschau eines fertigen Laufs */
function ResultView({
  run,
  stations,
  assignments,
  controllers,
  eventStart,
  totalMinutes,
}: {
  run: ApiSolverRun;
  stations: RosterStation[];
  assignments: Assignment[];
  controllers: RosterController[];
  eventStart: Date;
  totalMinutes: number;
}) {
  const result = run.result!;
  const nameByCid = new Map(controllers.map((c) => [c.cid, c.name]));
  const open = result.stations.reduce((n, s) => n + s.openMinutes, 0);
  const covered = result.stations.reduce((n, s) => n + s.coveredMinutes, 0);
  const unplanned = result.controllers.filter((c) => c.plannable && c.minutes === 0);
  const pct = (m: number) => `${(m / Math.max(1, totalMinutes)) * 100}%`;
  // Die Minuten des Laufs beziehen sich auf den Event-Beginn von damals; beim
  // Übernehmen bleiben die Uhrzeiten. Die Vorschau zeigt sie deshalb auf der
  // heutigen Zeitachse – was außerhalb liegt, wird beim Übernehmen ausgelassen.
  const shift = Math.round((new Date(result.eventStart).getTime() - eventStart.getTime()) / 60000);
  // Ersetzt werden nur Schichten, die seit dem Lauf unverändert sind – eine
  // danach bearbeitete bleibt beim Übernehmen stehen (wie in applySolverRun)
  const removed = new Set(result.removedAssignmentIds);
  const runState = new Map(result.removedAssignments.map((r) => [r.id, r]));
  const willRemove = (a: Assignment) => {
    if (!removed.has(a.id)) return false;
    const r = runState.get(a.id);
    if (!r) return false;
    return (
      a.stationId === r.stationId &&
      a.userCID === r.userCID &&
      a.start === r.start + shift &&
      a.end === r.end + shift
    );
  };
  // Nach dem Übernehmen steckt der Vorschlag schon im Plan – dann nur ihn
  // zeigen, sonst stünde jede Schicht doppelt da
  const applied = run.status === "applied";
  const current = applied ? [] : assignments.filter((a) => !willRemove(a));
  const kept = current.filter((a) => a.stationId !== null);
  // Was seit dem Lauf im Plan dazukam, hat Vorrang: kollidierende Vorschläge
  // lässt das Übernehmen aus – die Vorschau zeigt sie entsprechend blass.
  // Ebenso Schichten von Personen, die ihre Anmeldung inzwischen zurückzogen.
  const activeCids = new Set(controllers.filter((c) => !c.withdrawn).map((c) => c.cid));
  // Wie applySolverRun: Auch die Mindestpause zu inzwischen eingetragenen
  // Blöcken derselben Person muss reichen
  const minBreak = run.config.minBreakMinutes;
  const proposed = result.assignments
    .map((a) => ({ ...a, start: a.start + shift, end: a.end + shift }))
    .filter((a) => a.start >= 0 && a.end <= totalMinutes)
    .map((a) => ({
      ...a,
      conflict:
        (!applied && !activeCids.has(a.userCID)) ||
        current.some(
          (b) =>
            (b.start < a.end && a.start < b.end && b.stationId === a.stationId) ||
            (b.userCID !== null &&
              b.userCID === a.userCID &&
              b.type !== "custom" &&
              b.start < a.end + minBreak &&
              a.start < b.end + minBreak)
        ),
    }));
  const outside = result.assignments.length - proposed.length;
  const conflicts = proposed.filter((a) => a.conflict).length;
  const ticks = Array.from({ length: Math.floor(totalMinutes / 60) + 1 }, (_, i) => i * 60);

  return (
    <div className="space-y-4">
      <div className="text-sm">
        {run.status === "applied" && (
          <Badge variant="outline" className="mr-2">Übernommen</Badge>
        )}
        {result.assignments.length} Schichten vorgeschlagen • {open > 0 ? Math.round((covered / open) * 100) : 100} %
        der Stationszeit besetzt • {formatDuration(open - covered)} offen •{" "}
        {(result.durationMs / 1000).toFixed(1)} s gerechnet
      </div>

      {applied && (
        <p className="text-xs text-muted-foreground">
          Die Vorschau zeigt den Vorschlag, wie er übernommen wurde – ohne die übrigen Blöcke des Plans.
        </p>
      )}
      {conflicts > 0 && (
        <p className="text-xs text-warning-700 dark:text-warning-300">
          {conflicts} {conflicts === 1 ? "Vorschlag kollidiert" : "Vorschläge kollidieren"} mit
          Änderungen seit dem Lauf und {conflicts === 1 ? "wird" : "werden"} beim Übernehmen ausgelassen.
        </p>
      )}

      {shift !== 0 && (
        <p className="text-xs text-warning-700 dark:text-warning-300">
          Das Event wurde seit dem Lauf verschoben. Die Schichten bleiben zur geplanten Uhrzeit
          {outside > 0 ? `; ${outside} liegen jetzt außerhalb und werden ausgelassen` : ""}.
        </p>
      )}

      {result.notes.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
          {result.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {/* Vorschau: grau = bleibt, farbig = neu */}
      <div className="border rounded-md overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex border-b text-[10px] text-muted-foreground">
            <div className="w-40 shrink-0 px-2 py-1">Station</div>
            <div className="relative flex-1 h-5">
              {ticks.map((m) => (
                <span key={m} className="absolute top-1 -translate-x-1/2" style={{ left: pct(m) }}>
                  {minuteToHM(eventStart, m)}
                </span>
              ))}
            </div>
            <div className="w-16 shrink-0 px-2 py-1 text-right">besetzt</div>
          </div>
          {stations.map((st) => {
            const stats = result.stations.find((s) => s.callsign === st.callsign);
            const share = stats && stats.openMinutes > 0 ? stats.coveredMinutes / stats.openMinutes : 1;
            return (
              <div key={st.id} className="flex border-b last:border-b-0 items-center">
                <div className="w-40 shrink-0 px-2 py-1 font-mono text-xs truncate">
                  {st.callsign}
                  {stats && stats.priority === 0 && (
                    <span className="text-muted-foreground font-sans"> (aus)</span>
                  )}
                </div>
                <div className="relative flex-1 h-7 bg-danger-50/60 dark:bg-danger-950/20">
                  {kept
                    .filter((a) => a.stationId === st.id)
                    .map((a) => (
                      <div
                        key={`k${a.id}`}
                        className="absolute top-0.5 bottom-0.5 rounded-sm bg-muted-foreground/25 border border-muted-foreground/30 text-[10px] px-1 truncate"
                        style={{ left: pct(a.start), width: pct(a.end - a.start) }}
                        title={a.label ?? nameByCid.get(a.userCID ?? 0) ?? ""}
                      >
                        {a.label ?? nameByCid.get(a.userCID ?? 0) ?? ""}
                      </div>
                    ))}
                  {proposed
                    .filter((a) => a.stationId === st.id)
                    .map((a, i) => (
                      <div
                        key={`n${i}`}
                        className={cn(
                          "absolute top-0.5 bottom-0.5 rounded-sm text-[10px] px-1 truncate",
                          a.conflict
                            ? "border border-dashed border-primary/60 text-muted-foreground"
                            : "bg-primary/80 text-primary-foreground"
                        )}
                        style={{ left: pct(a.start), width: pct(a.end - a.start) }}
                        title={`${nameByCid.get(a.userCID) ?? a.userCID} ${minuteToHM(eventStart, a.start)}–${minuteToHM(eventStart, a.end)}z${
                          a.conflict ? " – wird ausgelassen (Konflikt mit dem aktuellen Plan)" : ""
                        }`}
                      >
                        {nameByCid.get(a.userCID) ?? a.userCID}
                      </div>
                    ))}
                </div>
                <div
                  className={cn(
                    "w-16 shrink-0 px-2 text-right text-xs tabular-nums",
                    share < 1 && "text-danger-700 dark:text-danger-300"
                  )}
                >
                  {Math.round(share * 100)} %
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-1">Zeit je Controller</h3>
          <div className="border rounded-md max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5 font-medium">Name</th>
                  <th className="p-1.5 font-medium text-right">Zeit</th>
                  <th className="p-1.5 font-medium text-right">Schichten</th>
                  <th className="p-1.5 font-medium text-right">auf Wunsch</th>
                </tr>
              </thead>
              <tbody>
                {result.controllers
                  .filter((c) => c.minutes > 0)
                  .map((c) => (
                    <tr key={c.cid} className="border-b last:border-b-0">
                      <td className="p-1.5">{c.name}</td>
                      <td className="p-1.5 text-right tabular-nums">{formatDuration(c.minutes)}</td>
                      <td className="p-1.5 text-right tabular-nums">{c.sessions}</td>
                      <td className="p-1.5 text-right tabular-nums">
                        {c.wishMinutes > 0 ? formatDuration(c.wishMinutes) : "–"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1">Nicht eingeplant</h3>
          {unplanned.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Alle, die eingeplant werden konnten, haben mindestens eine Schicht.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-1">
                Verfügbar und geeignet, aber ohne Schicht – meist, weil die Stationen schon
                besetzt sind oder die Verfügbarkeit nicht für eine ganze Schicht reicht.
              </p>
              <ul className="text-xs space-y-0.5">
                {unplanned.map((c) => (
                  <li key={c.cid}>
                    {c.name} <span className="text-muted-foreground">({c.cid})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SolverDialog;
