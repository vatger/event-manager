"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Repeat,
  MapPin,
  Clock,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
  startOfDay,
} from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicEvent {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  firCode: string;
  status: string;
  bannerUrl?: string | null;
  airports?: string[];
}

interface WeeklyOccurrence {
  id: number;
  date: string;
  config: {
    id: number;
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    fir?: {
      code: string;
      name: string;
    } | null;
  };
}

// ---------------------------------------------------------------------------
// FIR colour palette (matches admin calendar)
// ---------------------------------------------------------------------------

const FIR_COLORS: Record<string, { bg: string; text: string; hover: string; border: string; dot: string }> = {
  EDMM: {
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-800 dark:text-blue-200",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-800",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-600",
  },
  EDGG: {
    bg: "bg-emerald-100 dark:bg-emerald-900",
    text: "text-emerald-800 dark:text-emerald-200",
    hover: "hover:bg-emerald-200 dark:hover:bg-emerald-800",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-600",
  },
  EDWW: {
    bg: "bg-amber-100 dark:bg-amber-900",
    text: "text-amber-800 dark:text-amber-200",
    hover: "hover:bg-amber-200 dark:hover:bg-amber-800",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
};

const DEFAULT_COLORS = {
  bg: "bg-slate-100 dark:bg-slate-800",
  text: "text-slate-700 dark:text-slate-300",
  hover: "hover:bg-slate-200 dark:hover:bg-slate-700",
  border: "border-slate-300 dark:border-slate-600",
  dot: "bg-slate-500",
};

function firColors(code?: string | null) {
  return code && FIR_COLORS[code] ? FIR_COLORS[code] : DEFAULT_COLORS;
}

// ---------------------------------------------------------------------------
// Status label helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "In Planung",
  SIGNUP_OPEN: "Anmeldung offen",
  SIGNUP_CLOSED: "Anmeldung geschlossen",
  ROSTER_PUBLISHED: "Roster veröffentlicht",
  CANCELLED: "Abgesagt",
};

const STATUS_COLOR: Record<string, string> = {
  PLANNING: "bg-slate-500",
  SIGNUP_OPEN: "bg-green-600",
  SIGNUP_CLOSED: "bg-yellow-600",
  ROSTER_PUBLISHED: "bg-blue-600",
  CANCELLED: "bg-red-600",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PublicEventCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [weeklys, setWeeklys] = useState<WeeklyOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail dialog
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);

  // FIR filter (all shown by default)
  const [visibleFIRs, setVisibleFIRs] = useState<Set<string>>(
    new Set(["EDMM", "EDGG", "EDWW"])
  );
  const [showWeeklys, setShowWeeklys] = useState(true);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const [eventsRes, weeklysRes] = await Promise.all([
        fetch("/api/public/events"),
        fetch(
          `/api/public/weeklys?from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`
        ),
      ]);

      if (eventsRes.ok) {
        const allEvents: PublicEvent[] = await eventsRes.json();
        // Keep only events that overlap this month
        const filtered = allEvents.filter((e) => {
          const s = parseISO(e.startTime);
          const end = parseISO(e.endTime);
          return s <= monthEnd && end >= monthStart;
        });
        setEvents(filtered);
      }

      if (weeklysRes.ok) {
        const allWeeklys: WeeklyOccurrence[] = await weeklysRes.json();
        setWeeklys(allWeeklys);
      }
    } catch (err) {
      console.error("Fehler beim Laden des Kalenders", err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Calendar helpers
  // ---------------------------------------------------------------------------

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  function eventsForDay(day: Date) {
    const dayStart = startOfDay(day);
    return events.filter((e) => {
      const s = startOfDay(parseISO(e.startTime));
      const end = startOfDay(parseISO(e.endTime));
      return s <= dayStart && end >= dayStart && visibleFIRs.has(e.firCode);
    });
  }

  function weeklysForDay(day: Date) {
    if (!showWeeklys) return [];
    return weeklys.filter((w) => {
      const d = startOfDay(parseISO(w.date));
      const isSame = d.toDateString() === day.toDateString();
      const fir = w.config.fir?.code;
      return isSame && (fir ? visibleFIRs.has(fir) : true);
    });
  }

  function toggleFIR(fir: string) {
    setVisibleFIRs((prev) => {
      const next = new Set(prev);
      next.has(fir) ? next.delete(fir) : next.add(fir);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Event Kalender
              </h1>
              <p className="text-sm text-muted-foreground">
                Alle Events von VATSIM Germany
              </p>
            </div>
          </div>
        </div>

        {/* Month navigation + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Month picker */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold min-w-[160px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: de })}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="ml-1 text-xs"
            >
              Heute
            </Button>
          </div>

          {/* FIR filter chips */}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {Object.keys(FIR_COLORS).map((fir) => {
              const c = firColors(fir);
              const active = visibleFIRs.has(fir);
              return (
                <button
                  key={fir}
                  onClick={() => toggleFIR(fir)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all
                    ${active ? `${c.bg} ${c.text} ${c.border}` : "bg-muted text-muted-foreground border-transparent opacity-50"}`}
                >
                  <span className={`h-2 w-2 rounded-full ${active ? c.dot : "bg-muted-foreground"}`} />
                  {fir}
                </button>
              );
            })}
            <button
              onClick={() => setShowWeeklys((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all
                ${showWeeklys ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700" : "bg-muted text-muted-foreground border-transparent opacity-50"}`}
            >
              <Repeat className="h-3 w-3" />
              Weeklys
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-px bg-border">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-20 sm:h-24 rounded-none" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border">
              {calDays.map((day, idx) => {
                const dayEvents = eventsForDay(day);
                const dayWeeklys = weeklysForDay(day);
                const inMonth = isSameMonth(day, currentMonth);
                const todayFlag = isToday(day);
                const totalItems = dayEvents.length + dayWeeklys.length;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (totalItems > 0 || todayFlag) setSelectedDate(day);
                    }}
                    className={`
                      min-h-[80px] sm:min-h-[100px] p-1.5 bg-background transition-colors
                      ${inMonth ? "" : "bg-muted/30"}
                      ${totalItems > 0 ? "cursor-pointer hover:bg-accent/50" : ""}
                      ${todayFlag ? "ring-2 ring-inset ring-primary" : ""}
                    `}
                  >
                    {/* Day number */}
                    <div
                      className={`text-xs sm:text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                        ${todayFlag ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {format(day, "d")}
                    </div>

                    {/* Event chips */}
                    <div className="space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const c = firColors(ev.firCode);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(ev);
                            }}
                            className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${c.bg} ${c.text} ${c.hover} cursor-pointer`}
                            title={ev.name}
                          >
                            <span className={`hidden sm:inline-block shrink-0 text-[9px] font-bold px-1 py-0 rounded ${c.dot} text-white`}>
                              {ev.firCode}
                            </span>
                            <span className="truncate leading-none">{ev.name}</span>
                          </div>
                        );
                      })}

                      {dayWeeklys
                        .slice(0, Math.max(0, 2 - Math.min(dayEvents.length, 2)))
                        .map((w) => {
                          const c = firColors(w.config.fir?.code);
                          return (
                            <div
                              key={`w-${w.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                              }}
                              className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 border border-dashed opacity-70 hover:opacity-100 ${c.bg} ${c.text} cursor-pointer`}
                              title={`${w.config.name} (Weekly)`}
                            >
                              <Repeat className="h-2.5 w-2.5 shrink-0 hidden sm:block" />
                              <span className="truncate leading-none italic">{w.config.name}</span>
                            </div>
                          );
                        })}

                      {totalItems > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{totalItems - 2} weitere
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedDate && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })}
                </DialogTitle>
                <DialogDescription>
                  Events und Weeklys an diesem Tag
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Regular events */}
                {eventsForDay(selectedDate).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Events
                    </h3>
                    {eventsForDay(selectedDate).map((ev) => {
                      const c = firColors(ev.firCode);
                      return (
                        <Link
                          key={ev.id}
                          href={`/events/${ev.id}`}
                          className={`block p-3 rounded-lg border ${c.border} ${c.bg} ${c.hover} transition-colors`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-medium truncate ${c.text}`}>{ev.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(ev.startTime).toLocaleTimeString("de-DE", {
                                  timeZone: "UTC",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}z
                                {" – "}
                                {new Date(ev.endTime).toLocaleTimeString("de-DE", {
                                  timeZone: "UTC",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}z
                              </p>
                              {ev.airports && ev.airports.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {ev.airports.join(", ")}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <Badge className={`${c.dot} text-white text-[10px] px-1.5 py-0.5 border-0`}>
                                {ev.firCode}
                              </Badge>
                              {ev.status && (
                                <Badge
                                  className={`${STATUS_COLOR[ev.status] ?? "bg-slate-500"} text-white text-[10px] px-1.5 py-0.5 border-0`}
                                >
                                  {STATUS_LABEL[ev.status] ?? ev.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Weekly events */}
                {weeklysForDay(selectedDate).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Repeat className="h-4 w-4" /> Weeklys
                    </h3>
                    {weeklysForDay(selectedDate).map((w) => {
                      const c = firColors(w.config.fir?.code);
                      return (
                        <Link
                          key={`w-${w.id}`}
                          href={`/weeklys/${w.config.id}/occurrences/${w.id}`}
                          className={`block p-3 rounded-lg border border-dashed ${c.border} ${c.bg} ${c.hover} transition-colors`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-medium italic truncate ${c.text}`}>{w.config.name}</p>
                              {(w.config.startTime || w.config.endTime) && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {w.config.startTime}
                                  {w.config.endTime && ` – ${w.config.endTime}`} Uhr
                                </p>
                              )}
                            </div>
                            {w.config.fir && (
                              <Badge className={`${c.dot} text-white text-[10px] px-1.5 py-0.5 border-0 shrink-0`}>
                                {w.config.fir.code}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {eventsForDay(selectedDate).length === 0 &&
                  weeklysForDay(selectedDate).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Events an diesem Tag.
                    </p>
                  )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Single event quick-view dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-sm">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEvent.name}</DialogTitle>
                <DialogDescription>
                  {format(parseISO(selectedEvent.startTime), "EEEE, d. MMMM yyyy", { locale: de })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {selectedEvent.airports && selectedEvent.airports.length > 0 && (
                  <p className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selectedEvent.airports.join(", ")}
                  </p>
                )}
                <p className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {new Date(selectedEvent.startTime).toLocaleTimeString("de-DE", {
                    timeZone: "UTC",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}z
                  {" – "}
                  {new Date(selectedEvent.endTime).toLocaleTimeString("de-DE", {
                    timeZone: "UTC",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}z
                </p>
                <div className="flex items-center gap-2">
                  <Badge className={`${firColors(selectedEvent.firCode).dot} text-white border-0`}>
                    {selectedEvent.firCode}
                  </Badge>
                  {selectedEvent.status && (
                    <Badge className={`${STATUS_COLOR[selectedEvent.status] ?? "bg-slate-500"} text-white border-0`}>
                      {STATUS_LABEL[selectedEvent.status] ?? selectedEvent.status}
                    </Badge>
                  )}
                </div>
                <Link
                  href={`/events/${selectedEvent.id}`}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={() => setSelectedEvent(null)}
                >
                  Details anzeigen
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
