"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  RefreshCw,
  Search,
  TowerControl,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import { CPT_FIR_CODES, CPT_FIR_NAMES } from "@/config/cptFirMapping";
import type {
  CptApiResponse,
  CptEntry,
  CptFilter,
  CptFirPermissions,
  CptResponsible,
} from "../_lib/cptTypes";
import { isUpcoming, isUrgent, matchesQuery, URGENT_DAYS } from "../_lib/cptUtils";
import { CptCard } from "./CptCard";
import { ResponsiblesDialog } from "./ResponsiblesDialog";

/** Kennzahl-Karte im Stil der Eventübersicht, die zugleich den Filter setzt. */
function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  active,
  title,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Calendar;
  iconClass: string;
  active: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer border-gray-200 transition-colors dark:border-gray-800",
        active && "border-accent-500 ring-1 ring-accent-500/40"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={title}
      aria-pressed={active}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {value}
            </div>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              iconClass
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CPT Manager.
 *
 * Beantwortet die eine Frage, um die es dem Eventteam geht: Welche von der
 * ATD angesetzten CPTs sind noch nicht im Forum beworben – und wer kümmert
 * sich in dieser FIR darum?
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
  const past = useMemo(() => cpts.filter((c) => !isUpcoming(c)).reverse(), [cpts]);

  const stats = useMemo(
    () => ({
      total: upcoming.length,
      open: upcoming.filter((c) => !c.status.posted).length,
      posted: upcoming.filter((c) => c.status.posted).length,
      urgent: upcoming.filter((c) => isUrgent(c)).length,
    }),
    [upcoming]
  );

  const visible = useMemo(
    () =>
      upcoming.filter((cpt) => {
        if (!matchesQuery(cpt, query)) return false;
        if (filter === "open") return !cpt.status.posted;
        if (filter === "posted") return cpt.status.posted;
        if (filter === "urgent") return isUrgent(cpt);
        return true;
      }),
    [upcoming, filter, query]
  );

  const visiblePast = useMemo(
    () => past.filter((cpt) => matchesQuery(cpt, query)),
    [past, query]
  );

  /** Darf der Nutzer den Arbeitsstand dieses CPTs pflegen? */
  const canEdit = useCallback(
    (cpt: CptEntry) => !!cpt.firCode && (permissions[cpt.firCode]?.canEditStatus ?? false),
    [permissions]
  );

  /**
   * Gepostet-Markierung umschalten. Die Karte springt sofort um und wird bei
   * einem Fehler zurückgedreht – das Markieren soll sich unmittelbar anfühlen.
   */
  const togglePosted = useCallback(
    async (cpt: CptEntry) => {
      const next = !cpt.status.posted;
      setBusyId(cpt.id);
      setCpts((prev) =>
        prev.map((c) =>
          c.id === cpt.id ? { ...c, status: { ...c.status, posted: next } } : c
        )
      );

      try {
        const res = await fetch(`/api/cpt/${cpt.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posted: next }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Speichern fehlgeschlagen");

        setCpts((prev) =>
          prev.map((c) => (c.id === cpt.id ? { ...c, status: json.status } : c))
        );
        toast.success(
          next
            ? `${cpt.position} als gepostet markiert`
            : `Markierung für ${cpt.position} zurückgenommen`
        );
      } catch (err) {
        setCpts((prev) =>
          prev.map((c) => (c.id === cpt.id ? { ...c, status: cpt.status } : c))
        );
        toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const activeFir = fir ?? null;
  const firResponsibles = activeFir ? responsibles[activeFir] ?? [] : [];
  const canEditResponsibles = activeFir
    ? permissions[activeFir]?.canEditResponsibles ?? false
    : false;

  return (
    <div className="min-h-screen">
      <div className="mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-100">
              CPT Manager
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {activeFir ? CPT_FIR_NAMES[activeFir] ?? activeFir : "Alle FIRs"} ·
              Bewerbung der von der ATD angesetzten CPTs
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setResponsiblesOpen(true)}
              disabled={!activeFir}
              className="flex-1 sm:flex-none"
            >
              <Users className="mr-2 h-4 w-4" />
              Verantwortliche
              {activeFir && (
                <Badge variant="secondary" className="ml-2">
                  {firResponsibles.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void load({ silent: true })}
              disabled={refreshing || loading}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Aktualisieren
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Kennzahlen – zugleich die Filter */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Anstehend"
            value={stats.total}
            icon={Calendar}
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatCard
            label="Offen"
            value={stats.open}
            icon={Clock}
            iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
            title="Anstehende CPTs ohne Forumsbeitrag"
            active={filter === "open"}
            onClick={() => setFilter("open")}
          />
          <StatCard
            label="Dringend"
            value={stats.urgent}
            icon={AlertTriangle}
            iconClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            title={`Noch nicht gepostet und in höchstens ${URGENT_DAYS} Tagen`}
            active={filter === "urgent"}
            onClick={() => setFilter("urgent")}
          />
          <StatCard
            label="Gepostet"
            value={stats.posted}
            icon={CheckCircle2}
            iconClass="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            active={filter === "posted"}
            onClick={() => setFilter("posted")}
          />
        </div>

        {/* Filter */}
        <Card className="mb-6 border-gray-200 dark:border-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="CPTs suchen (Trainee, Position, CID)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select
                  value={filter}
                  onValueChange={(value) => setFilter(value as CptFilter)}
                >
                  <SelectTrigger className="w-full sm:w-[170px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status filtern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle CPTs</SelectItem>
                    <SelectItem value="open">Nicht gepostet</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                    <SelectItem value="posted">Gepostet</SelectItem>
                  </SelectContent>
                </Select>

                {isVATGERLead() && (
                  <Select
                    value={fir ?? "ALL"}
                    onValueChange={(value) => setFir(value === "ALL" ? undefined : value)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="FIR auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Alle FIRs</SelectItem>
                      {CPT_FIR_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code} – {(CPT_FIR_NAMES[code] ?? code).replace("FIR ", "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {activeFir && !loading && firResponsibles.length === 0 && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>
                Für {CPT_FIR_NAMES[activeFir] ?? activeFir} ist niemand als
                CPT-Verantwortlicher eingetragen – Erinnerungen gehen ersatzweise
                an die FIR-Leitung.
              </span>
              {canEditResponsibles && (
                <Button variant="outline" size="sm" onClick={() => setResponsiblesOpen(true)}>
                  Jetzt eintragen
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Anstehende CPTs */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
              <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Anstehende CPTs
              </h2>
              <Badge variant="outline" className="ml-1">
                {visible.length}
                {visible.length !== stats.total ? ` von ${stats.total}` : ""}
              </Badge>
            </div>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-accent-600" />
              </div>
            ) : visible.length === 0 ? (
              <div className="py-12 text-center">
                <TowerControl className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400">
                  {stats.total === 0
                    ? "Aktuell sind keine CPTs angesetzt"
                    : "Keine CPTs für diese Auswahl"}
                </p>
                {stats.total > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {visible.map((cpt) => (
                  <CptCard
                    key={cpt.id}
                    cpt={cpt}
                    canEdit={canEdit(cpt)}
                    busy={busyId === cpt.id}
                    onTogglePosted={() => void togglePosted(cpt)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vergangene CPTs bleiben erreichbar, drängen sich aber nicht auf */}
        {!loading && past.length > 0 && (
          <Card className="mt-6 border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 sm:p-6">
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="flex w-full items-center gap-2 text-left"
                aria-expanded={showPast}
              >
                {showPast ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Vergangene CPTs
                </h2>
                <Badge variant="outline" className="ml-1">
                  {past.length}
                </Badge>
              </button>

              {showPast && (
                <div className="mt-4 grid grid-cols-1 gap-4 opacity-80 xl:grid-cols-2">
                  {visiblePast.map((cpt) => (
                    <CptCard
                      key={cpt.id}
                      cpt={cpt}
                      canEdit={canEdit(cpt)}
                      busy={busyId === cpt.id}
                      onTogglePosted={() => void togglePosted(cpt)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
    </div>
  );
}
