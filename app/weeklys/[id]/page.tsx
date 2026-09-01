"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Repeat,
  Plane,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import EventBanner from "@/components/Eventbanner";
import { STATUS_TONE_CLASS } from "@/lib/events/eventDisplay";
import {
  WEEKDAYS_FULL,
  weeklyAirportList,
  weeklyPatternDetail,
  weeklyPatternShort,
  occurrenceStatus,
} from "@/lib/weeklys/publicDisplay";

interface FIR {
  code: string;
  name: string;
}

interface WeeklyOccurrence {
  id: number;
  date: string;
  signupDeadline: string | null;
  rosterPublished: boolean;
  eventId: number | null;
  signupStatus: "open" | "closed" | "auto";
}

interface WeeklyConfig {
  id: number;
  firId: number | null;
  fir?: FIR;
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  bannerUrl?: string | null;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
  enabled: boolean;
  occurrences: WeeklyOccurrence[];
  pastOccurrences: WeeklyOccurrence[];
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Helper types for calendar display
interface CalendarWeek {
  type: "occurrence" | "pause";
  date: Date;
  occurrence?: WeeklyOccurrence;
}

export default function WeeklyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [config, setConfig] = useState<WeeklyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPastOccurrences, setShowPastOccurrences] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchWeeklyConfig();
    }
  }, [params.id]);

  const fetchWeeklyConfig = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/weeklys/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        setError("Wöchentliches Event nicht gefunden");
      }
    } catch {
      setError("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generates a complete calendar view including pause weeks
   * Shows the full pattern of active and pause weeks
   */
  const generateCalendarWeeks = (): CalendarWeek[] => {
    if (!config || config.occurrences.length === 0) return [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const toLocalDate = (dateStr: string): Date => {
      const d = new Date(dateStr);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    const upcomingOccurrences = config.occurrences
      .filter((occ) => toLocalDate(occ.date) >= todayStart)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcomingOccurrences.length === 0) return [];

    const result: CalendarWeek[] = [];

    for (let i = 0; i < upcomingOccurrences.length; i++) {
      const occ = upcomingOccurrences[i];
      const occDate = toLocalDate(occ.date);

      // Pause-Wochen zwischen vorheriger und aktueller Occurrence einfügen
      if (i > 0) {
        const prevDate = toLocalDate(upcomingOccurrences[i - 1].date);
        const checkDate = new Date(prevDate);
        checkDate.setDate(checkDate.getDate() + 7);

        while (checkDate < occDate) {
          result.push({ type: "pause", date: new Date(checkDate) });
          checkDate.setDate(checkDate.getDate() + 7);
        }
      }

      result.push({ type: "occurrence", date: occDate, occurrence: occ });
    }

    return result.slice(0, 10);
  };

  /**
   * Generates past calendar weeks (already occurred occurrences),
   * sorted most-recent first.
   */
  const generatePastCalendarWeeks = (): CalendarWeek[] => {
    if (!config || !config.pastOccurrences || config.pastOccurrences.length === 0) return [];

    const toLocalDate = (dateStr: string): Date => {
      const d = new Date(dateStr);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // Already sorted most-recent first by the API
    return config.pastOccurrences.map((occ) => ({
      type: "occurrence" as const,
      date: toLocalDate(occ.date),
      occurrence: occ,
    }));
  };

  /** Anmeldestatus eines Termins – Text und Bedeutungston aus dem gemeinsamen Modul. */
  const statusOf = (occurrence: WeeklyOccurrence) =>
    occurrenceStatus({
      requiresRoster: !!config?.requiresRoster,
      rosterPublished: occurrence.rosterPublished,
      signupStatus: occurrence.signupStatus,
      date: new Date(occurrence.date),
      signupDeadline: occurrence.signupDeadline ? new Date(occurrence.signupDeadline) : null,
    });

  const airports = weeklyAirportList(config?.airports);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Event nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="-ml-2 gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        Zur Übersicht
      </Button>

      {/* Kopfbereich im Zuschnitt der Weekly-Karte, aus der man hierherkommt */}
      <div className="relative h-64 overflow-hidden rounded-2xl border bg-primary-900 md:h-80">
        <EventBanner
          bannerUrl={config.bannerUrl ?? ""}
          eventName={config.name}
          className="absolute inset-0 h-full w-full object-cover object-center"
          showFallbackCaption={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/60 to-transparent" />

        <div className="absolute left-5 top-4 flex flex-wrap items-center gap-1.5 sm:left-7">
          <Badge className="bg-primary-100 font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
            {weeklyPatternShort(config.weekday, config.weeksOff)}
          </Badge>
          {config.fir?.code && (
            <Badge className="bg-secondary-50/15 font-semibold text-secondary-50 backdrop-blur-sm">
              {config.fir.code}
            </Badge>
          )}
          {!config.enabled && (
            <Badge className={cn("font-medium", STATUS_TONE_CLASS.warning)}>Deaktiviert</Badge>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pb-5 pt-8 sm:px-7">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-500">
            {weeklyPatternDetail(config.weeksOn, config.weeksOff)}
            {config.startTime && config.endTime ? ` · ${config.startTime} – ${config.endTime} lcl` : ""}
          </span>
          <h1 className="text-pretty text-2xl font-bold leading-tight text-secondary-50 sm:text-3xl">
            {config.name}
          </h1>
          {airports.length > 0 && (
            <span className="flex min-w-0 items-center gap-1.5 text-sm text-secondary-300">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate" title={airports.join(", ")}>
                {airports.length > 3 ? `${airports.length} Flughäfen` : airports.join(", ")}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Fakten */}
      <Card>
        <CardContent className="p-5">
          {config.description && (
            <div className="mb-5 border-b pb-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{config.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
                <Calendar className="h-4 w-4 text-primary-700 dark:text-primary-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Wochentag</p>
                <p className="font-medium">{WEEKDAYS_FULL[config.weekday]}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
                <Repeat className="h-4 w-4 text-success-800 dark:text-success-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Rhythmus</p>
                <p className="font-medium">{weeklyPatternDetail(config.weeksOn, config.weeksOff)}</p>
              </div>
            </div>

            {(config.startTime || config.endTime) && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/40">
                  <Clock className="h-4 w-4 text-warning-800 dark:text-warning-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Uhrzeit (Lokalzeit)</p>
                  <p className="font-medium">
                    {config.startTime || "?"} – {config.endTime || "?"}
                  </p>
                </div>
              </div>
            )}

            {airports.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 dark:bg-secondary-800">
                  <Plane className="h-4 w-4 text-secondary-700 dark:text-secondary-200" />
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {airports.length === 1 ? "Flughafen" : "Flughäfen"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {airports.map((apt) => (
                      <Badge key={apt} variant="outline" className="font-mono text-xs">
                        {apt}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {config.requiresRoster && config.staffedStations && config.staffedStations.length > 0 && (
            <div className="mt-5 border-t pt-5">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Gerosterte Stationen</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.staffedStations.map((station) => (
                  <Badge key={station} variant="outline" className="py-1 font-mono">
                    {station}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kommende Termine */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Kommende Termine</h2>
          <Badge variant="outline">Nächste 10 Wochen</Badge>
        </div>

        {(() => {
          const calendarWeeks = generateCalendarWeeks();

          if (calendarWeeks.length === 0) {
            return (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Keine kommenden Termine</p>
                </CardContent>
              </Card>
            );
          }

          return (
            <div className="space-y-3">
              {calendarWeeks.map((week, index) => {
                const occDate = week.date;
                const isFirst = index === 0;

                const dayOfMonth = format(occDate, "dd");
                const month = MONTHS[occDate.getMonth()];
                const weekday = WEEKDAYS_FULL[occDate.getDay()];
                const formattedDate = format(occDate, "dd.MM.yyyy", { locale: de });

                if (week.type === "pause") {
                  return (
                    <div key={`pause-${occDate.getTime()}`} className="flex items-stretch overflow-hidden rounded-xl border border-dashed bg-muted/30 opacity-60">
                      <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-dashed py-3">
                        <span className="text-xl font-bold leading-none text-muted-foreground">{dayOfMonth}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{month}</span>
                        <span className="text-[10px] text-muted-foreground">{weekday}</span>
                      </div>
                      <div className="flex flex-1 items-center justify-center p-4">
                        <div className="text-center">
                          <div className="mb-1 flex items-center justify-center gap-2">
                            <Repeat className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-muted-foreground">Pause-Woche</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formattedDate} · kein Event</p>
                        </div>
                      </div>
                    </div>
                  );
                }

                const occurrence = week.occurrence;
                if (!occurrence) return null;
                const status = statusOf(occurrence);

                return (
                  <Link
                    key={occurrence.id}
                    href={`/weeklys/${config.id}/occurrences/${occurrence.id}`}
                    className="block"
                  >
                    <div
                      className={cn(
                        "flex items-stretch overflow-hidden rounded-xl border transition-all hover:border-accent-500/40 hover:shadow-sm",
                        isFirst && "border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20"
                      )}
                    >
                      <div
                        className={cn(
                          "flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r py-3",
                          isFirst ? "bg-primary-100 dark:bg-primary-900/40" : "bg-muted/40"
                        )}
                      >
                        <span className="text-xl font-bold leading-none tabular-nums">{dayOfMonth}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider">{month}</span>
                        <span className="text-[10px] text-muted-foreground">{weekday}</span>
                      </div>

                      <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold">{formattedDate}</h3>
                          {config.startTime && config.endTime && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{config.startTime} – {config.endTime} Uhr</span>
                            </div>
                          )}
                        </div>

                        {config.requiresRoster && (
                          <div className="flex items-center gap-3">
                            <Badge className={cn("font-medium", STATUS_TONE_CLASS[status.tone])}>
                              {status.label}
                            </Badge>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 px-3 text-sm">
                              Details
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Archiv */}
      {(() => {
        const pastWeeks = generatePastCalendarWeeks();
        if (pastWeeks.length === 0) return null;

        return (
          <div className="space-y-3">
            <button
              onClick={() => setShowPastOccurrences((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
            >
              {showPastOccurrences ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Vergangene Termine ausblenden
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <History className="h-4 w-4" />
                  {pastWeeks.length} vergangene{pastWeeks.length === 1 ? " Termin" : " Termine"} anzeigen
                </>
              )}
            </button>

            {showPastOccurrences && (
              <div className="space-y-2">
                <div className="mb-1 flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Vergangene Termine
                  </h3>
                </div>
                {pastWeeks.map((week) => {
                  const occDate = week.date;
                  const occurrence = week.occurrence!;
                  const dayOfMonth = format(occDate, "dd");
                  const month = MONTHS[occDate.getMonth()];
                  const weekday = WEEKDAYS_FULL[occDate.getDay()];
                  const formattedDate = format(occDate, "dd.MM.yyyy", { locale: de });

                  return (
                    <Link
                      key={occurrence.id}
                      href={`/weeklys/${config!.id}/occurrences/${occurrence.id}`}
                      className="block"
                    >
                      <div className="flex items-stretch overflow-hidden rounded-xl border opacity-70 transition-all hover:opacity-90 hover:shadow-sm">
                        <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 border-r bg-muted/30 py-3">
                          <span className="text-xl font-bold leading-none text-muted-foreground">{dayOfMonth}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{month}</span>
                          <span className="text-[10px] text-muted-foreground">{weekday}</span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-muted-foreground">{formattedDate}</h3>
                            {config!.startTime && config!.endTime && (
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{config!.startTime} – {config!.endTime} Uhr</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {occurrence.rosterPublished && (
                              <Badge className={cn("text-xs font-medium", STATUS_TONE_CLASS.highlight)}>
                                Roster veröffentlicht
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 gap-1 px-3 text-sm">
                              Details
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
