"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  History,
  ImageIcon,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldCheck,
  TowerControl,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import { CPT_FIR_CODES, CPT_FIR_NAMES } from "@/config/cptFirMapping";
import type {
  CptApiResponse,
  CptEntry,
  CptFilter,
  CptFirPermissions,
  CptResponsible,
  CptStatus,
} from "../_lib/cptTypes";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  bucketOf,
  isUpcoming,
  isUrgent,
  matchesQuery,
  URGENT_DAYS,
} from "../_lib/cptUtils";
import { CptRow } from "./CptRow";
import { CptDetailPanel } from "./CptDetailPanel";
import { ResponsiblesDialog } from "./ResponsiblesDialog";

/** Eine anklickbare Kennzahl der Kopfleiste, die zugleich den Filter setzt. */
function StatTile({
  label,
  value,
  icon: Icon,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Circle;
  active: boolean;
  tone: "neutral" | "warning" | "success" | "danger";
  onClick: () => void;
}) {
  const toneClass = {
    neutral: "text-foreground",
    warning: "text-warning-600 dark:text-warning-400",
    success: "text-success-600 dark:text-success-400",
    danger: "text-danger-600 dark:text-danger-400",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-all hover:shadow-sm",
        active ? "border-accent-500 ring-1 ring-accent-500/40" : "hover:border-accent-500/40"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", toneClass)} />
      <div className="min-w-0">
        <p className={cn("text-2xl font-bold leading-none tabular-nums", toneClass)}>
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </button>
  );
}

/**
 * CPT Manager.
 *
 * Der Manager beantwortet eine einzige Frage zuverlässig: Welche von der ATD
 * angesetzten CPTs sind noch nicht im Forum beworben – und wer kümmert sich
 * darum? Alles andere (Termin, Prüfer, Banner) hängt daran.
 */
export function CptManager() {
  const { user, isVATGERLead } = useUser();

  const [cpts, setCpts] = useState<CptEntry[]>([]);
  const [permissions, setPermissions] = useState<Record<string, CptFirPermissions>>({});
  const [responsibles, setResponsibles] = useState<Record<string, CptResponsible[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fir, setFir] = useState<string | undefined>(undefined);
  // Erst wenn die Vorauswahl feststeht, wird geladen – sonst holt die Seite
  // einmal alle FIRs und direkt danach noch einmal die eigene.
  const [firReady, setFirReady] = useState(false);
  const [filter, setFilter] = useState<CptFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [responsiblesOpen, setResponsiblesOpen] = useState(false);

  // Die eigene FIR ist die sinnvolle Voreinstellung; die VATGER-Leitung
  // beginnt bei „Alle FIRs" und wählt selbst.
  useEffect(() => {
    if (firReady || !user) return;
    if (user.fir?.code) setFir(user.fir.code);
    setFirReady(true);
  }, [user, firReady]);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      try {
        const url = fir ? `/api/cpt?fir=${encodeURIComponent(fir)}` : "/api/cpt";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fehler beim Laden der CPT-Daten");
        const json: CptApiResponse = await res.json();
        setCpts(json.data ?? []);
        setPermissions(json.permissions ?? {});
        setResponsibles(json.responsibles ?? {});
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fir]
  );

  useEffect(() => {
    if (!firReady) return;
    void load();
  }, [load, firReady]);

  const upcoming = useMemo(() => cpts.filter((c) => isUpcoming(c)), [cpts]);
  const past = useMemo(
    () => cpts.filter((c) => !isUpcoming(c)).reverse(),
    [cpts]
  );

  const stats = useMemo(
    () => ({
      total: upcoming.length,
      open: upcoming.filter((c) => !c.status.posted).length,
      posted: upcoming.filter((c) => c.status.posted).length,
      urgent: upcoming.filter((c) => isUrgent(c)).length,
    }),
    [upcoming]
  );

  const visible = useMemo(() => {
    return upcoming.filter((cpt) => {
      if (!matchesQuery(cpt, query)) return false;
      if (filter === "open") return !cpt.status.posted;
      if (filter === "posted") return cpt.status.posted;
      if (filter === "urgent") return isUrgent(cpt);
      return true;
    });
  }, [upcoming, filter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CptEntry[]>();
    for (const cpt of visible) {
      const bucket = bucketOf(cpt);
      if (bucket === "past") continue;
      const list = map.get(bucket) ?? [];
      list.push(cpt);
      map.set(bucket, list);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
      bucket: b,
      items: map.get(b)!,
    }));
  }, [visible]);

  const selected = useMemo(
    () => cpts.find((c) => c.id === selectedId) ?? null,
    [cpts, selectedId]
  );

  /** Darf der Nutzer den Arbeitsstand dieses CPTs pflegen? */
  const canEdit = useCallback(
    (cpt: CptEntry) =>
      !!cpt.firCode && (permissions[cpt.firCode]?.canEditStatus ?? false),
    [permissions]
  );

  /**
   * Änderungen am Arbeitsstand. Die Zeile wird sofort umgestellt und bei
   * einem Fehler wieder zurückgedreht – Markieren soll sich sofort anfühlen.
   */
  const patchStatus = useCallback(
    async (cptId: number, patch: Partial<Pick<CptStatus, "posted" | "forumUrl" | "notes">>) => {
      const before = cpts.find((c) => c.id === cptId);
      if (!before) return;

      setBusyId(cptId);
      setCpts((prev) =>
        prev.map((c) => (c.id === cptId ? { ...c, status: { ...c.status, ...patch } } : c))
      );

      try {
        const res = await fetch(`/api/cpt/${cptId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Speichern fehlgeschlagen");

        setCpts((prev) =>
          prev.map((c) => (c.id === cptId ? { ...c, status: json.status } : c))
        );
        if (patch.posted !== undefined) {
          toast.success(
            patch.posted
              ? `${before.position} als gepostet markiert`
              : `Markierung für ${before.position} zurückgenommen`
          );
        }
      } catch (err) {
        setCpts((prev) =>
          prev.map((c) => (c.id === cptId ? { ...c, status: before.status } : c))
        );
        toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
        throw err;
      } finally {
        setBusyId(null);
      }
    },
    [cpts]
  );

  // Verantwortliche der aktuell gewählten FIR (ohne FIR-Auswahl: nichts zu zeigen)
  const activeFir = fir ?? null;
  const firResponsibles = activeFir ? responsibles[activeFir] ?? [] : [];
  const canEditResponsibles = activeFir
    ? permissions[activeFir]?.canEditResponsibles ?? false
    : false;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kopfleiste: Titel, FIR-Auswahl, Suche und Aktionen */}
      <header className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3">
        <div className="mr-1 flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10">
            <TowerControl className="h-5 w-5 text-accent-500" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight">CPT Manager</h1>
            <p className="truncate text-xs text-muted-foreground">
              {activeFir ? CPT_FIR_NAMES[activeFir] ?? activeFir : "Alle FIRs"} ·{" "}
              {stats.open} offen
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {stats.urgent > 0 && (
            <button type="button" onClick={() => setFilter("urgent")}>
              <Badge className="cursor-pointer bg-danger-600 text-white hover:bg-danger-700">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {stats.urgent} dringend
              </Badge>
            </button>
          )}
          {activeFir && (
            <button type="button" onClick={() => setResponsiblesOpen(true)}>
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer gap-1",
                  firResponsibles.length === 0 && "border-warning-400 text-warning-700 dark:text-warning-400"
                )}
                title="CPT-Verantwortliche dieser FIR"
              >
                <Users className="h-3 w-3" />
                {firResponsibles.length === 0
                  ? "Keine Verantwortlichen"
                  : `${firResponsibles.length} Verantwortliche`}
              </Badge>
            </button>
          )}
          {(filter !== "all" || query) && (
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-accent-500/50 bg-accent-500/10 px-2 py-0.5 text-xs text-accent-600 dark:text-accent-400"
            >
              Filter aktiv · {visible.length} von {stats.total}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Trainee, Position, CID…"
              className="h-9 w-44 pl-8 lg:w-60"
            />
          </div>

          {isVATGERLead() && (
            <Select
              value={fir ?? "ALL"}
              onValueChange={(value) => setFir(value === "ALL" ? undefined : value)}
            >
              <SelectTrigger className="h-9 w-[110px]">
                <SelectValue placeholder="FIR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle FIRs</SelectItem>
                {CPT_FIR_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => void load({ silent: true })}
            disabled={refreshing}
            aria-label="Aktualisieren"
            title="Aktualisieren"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Weitere Aktionen"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                onClick={() => setResponsiblesOpen(true)}
                disabled={!activeFir}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verantwortliche verwalten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPast((v) => !v)}>
                <History className="mr-2 h-4 w-4" />
                Vergangene CPTs {showPast ? "ausblenden" : "anzeigen"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/edmm/cpt-banner">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Banner-Generator
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Kennzahlen doppeln als Filter */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Anstehende CPTs"
          value={stats.total}
          icon={TowerControl}
          tone="neutral"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatTile
          label="Noch nicht beworben"
          value={stats.open}
          icon={Circle}
          tone="warning"
          active={filter === "open"}
          onClick={() => setFilter("open")}
        />
        <StatTile
          label={`Dringend (≤ ${URGENT_DAYS} Tage)`}
          value={stats.urgent}
          icon={AlertTriangle}
          tone="danger"
          active={filter === "urgent"}
          onClick={() => setFilter("urgent")}
        />
        <StatTile
          label="Im Forum gepostet"
          value={stats.posted}
          icon={CheckCircle2}
          tone="success"
          active={filter === "posted"}
          onClick={() => setFilter("posted")}
        />
      </div>

      {activeFir && firResponsibles.length === 0 && (
        <Alert className="border-warning-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              Für {CPT_FIR_NAMES[activeFir] ?? activeFir} ist niemand als
              CPT-Verantwortlicher eingetragen – Erinnerungen gehen ersatzweise
              an die FIR-Leitung.
            </span>
            {canEditResponsibles && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResponsiblesOpen(true)}
              >
                Jetzt eintragen
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Liste und Detailbereich teilen sich die Fläche */}
      <div
        className={cn(
          "grid gap-4",
          selected ? "lg:grid-cols-[minmax(0,1fr)_23rem]" : "grid-cols-1"
        )}
      >
        {/* Eigener Bildlauf: nur so bleiben die Gruppenüberschriften oben
            stehen, während die Liste durchläuft. */}
        <div className="min-h-[18rem] max-h-[calc(100vh-19rem)] min-w-0 overflow-y-auto rounded-xl border bg-card">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
              <TowerControl className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {upcoming.length === 0
                  ? "Aktuell sind keine CPTs angesetzt."
                  : "Keine CPTs für diese Auswahl."}
              </p>
              {upcoming.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => { setFilter("all"); setQuery(""); }}>
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          ) : (
            grouped.map(({ bucket, items }) => (
              <section key={bucket}>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-muted/60 px-4 py-1.5 backdrop-blur">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {BUCKET_LABELS[bucket]}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                <div className="px-3">
                  {items.map((cpt) => (
                    <CptRow
                      key={cpt.id}
                      cpt={cpt}
                      selected={cpt.id === selectedId}
                      canEdit={canEdit(cpt)}
                      busy={busyId === cpt.id}
                      onSelect={() =>
                        setSelectedId((id) => (id === cpt.id ? null : cpt.id))
                      }
                      onTogglePosted={() =>
                        void patchStatus(cpt.id, { posted: !cpt.status.posted }).catch(
                          () => {}
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {/* Vergangene CPTs bleiben erreichbar, drängen sich aber nicht auf */}
          {past.length > 0 && (
            <div className="border-t">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted/50"
              >
                {showPast ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Vergangene CPTs
                <span className="ml-auto tabular-nums">{past.length}</span>
              </button>
              {showPast && (
                <div className="px-3 opacity-70">
                  {past
                    .filter((cpt) => matchesQuery(cpt, query))
                    .map((cpt) => (
                      <CptRow
                        key={cpt.id}
                        cpt={cpt}
                        selected={cpt.id === selectedId}
                        canEdit={canEdit(cpt)}
                        busy={busyId === cpt.id}
                        onSelect={() =>
                          setSelectedId((id) => (id === cpt.id ? null : cpt.id))
                        }
                        onTogglePosted={() =>
                          void patchStatus(cpt.id, {
                            posted: !cpt.status.posted,
                          }).catch(() => {})
                        }
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
            <CptDetailPanel
              cpt={selected}
              canEdit={canEdit(selected)}
              onClose={() => setSelectedId(null)}
              onPatch={patchStatus}
            />
          </div>
        )}
      </div>

      {activeFir && (
        <ResponsiblesDialog
          open={responsiblesOpen}
          onOpenChange={setResponsiblesOpen}
          firCode={activeFir}
          responsibles={firResponsibles}
          canEdit={canEditResponsibles}
          onChanged={() => void load({ silent: true })}
        />
      )}
    </div>
  );
}
