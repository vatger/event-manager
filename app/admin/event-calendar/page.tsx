"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/useUser";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  Ban,
  CalendarDays,
  Clock,
  Pencil,
  Repeat,
  TrashIcon,
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
import { useRouter } from "next/navigation";

interface Event {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  firCode: string;
  status: string;
}

interface WeeklyEvent {
  id: number;
  date: string;
  config: {
    id: number;
    name: string;
    startTime?: string;
    endTime?: string;
    fir?: {
      code: string;
    };
  };
}

interface BlockedDate {
  id: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// FIR colour palette (matches public calendar)
// ---------------------------------------------------------------------------

const FIR_COLORS: Record<string, { bg: string; text: string; hover: string; border: string; dot: string; badge: string }> = {
  EDMM: {
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-800 dark:text-blue-200",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-800",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-600",
    badge: "bg-blue-600 text-white",
  },
  EDGG: {
    bg: "bg-emerald-100 dark:bg-emerald-900",
    text: "text-emerald-800 dark:text-emerald-200",
    hover: "hover:bg-emerald-200 dark:hover:bg-emerald-800",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-600",
    badge: "bg-emerald-600 text-white",
  },
  EDWW: {
    bg: "bg-amber-100 dark:bg-amber-900",
    text: "text-amber-800 dark:text-amber-200",
    hover: "hover:bg-amber-200 dark:hover:bg-amber-800",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
    badge: "bg-amber-500 text-white",
  },
};

const DEFAULT_COLORS = {
  bg: "bg-slate-100 dark:bg-slate-800",
  text: "text-slate-700 dark:text-slate-300",
  hover: "hover:bg-slate-200 dark:hover:bg-slate-700",
  border: "border-slate-300 dark:border-slate-600",
  dot: "bg-slate-500",
  badge: "bg-slate-500 text-white",
};

function firColors(code?: string | null) {
  return code && FIR_COLORS[code] ? FIR_COLORS[code] : DEFAULT_COLORS;
}

export default function EventCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);

  // FIR Filter State
  const [visibleFIRs, setVisibleFIRs] = useState<Set<string>>(new Set(["EDMM", "EDGG", "EDWW"]));

  // Weekly Events Toggle
  const [showWeeklyEvents, setShowWeeklyEvents] = useState(true);

  const { isVATGERLead } = useUser();
  const router = useRouter();

  // Block date form state
  const [blockForm, setBlockForm] = useState({
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    reason: "",
    description: "",
  });

  // Toggle FIR visibility
  const toggleFIR = (fir: string) => {
    setVisibleFIRs((prev) => {
      const next = new Set(prev);
      next.has(fir) ? next.delete(fir) : next.add(fir);
      return next;
    });
  };

  // Fetch events and blocked dates
  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Fetch events for the current month (admin endpoint – includes DRAFTs)
      const eventsRes = await fetch("/api/events");
      if (eventsRes.ok) {
        const allEvents: Event[] = await eventsRes.json();
        const monthEvents = allEvents.filter((event) => {
          const eventStart = parseISO(event.startTime);
          const eventEnd = parseISO(event.endTime);
          return (
            (eventStart >= monthStart && eventStart <= monthEnd) ||
            (eventEnd >= monthStart && eventEnd <= monthEnd) ||
            (eventStart <= monthStart && eventEnd >= monthEnd)
          );
        });
        setEvents(monthEvents);
      }

      // Fetch weekly event occurrences for the current month
      const weeklyRes = await fetch(
        `/api/public/weeklys?from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`
      );
      if (weeklyRes.ok) {
        const allWeeklyEvents: WeeklyEvent[] = await weeklyRes.json();
        setWeeklyEvents(allWeeklyEvents);
      }

      // Fetch blocked dates for the current month
      const blockedRes = await fetch(
        `/api/calendar/blocked-dates?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`
      );
      if (blockedRes.ok) {
        const blocked: BlockedDate[] = await blockedRes.json();
        setBlockedDates(blocked);
      }
    } catch (err) {
      console.error("Failed to fetch calendar data", err);
      setError("Fehler beim Laden der Kalenderdaten");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Helper functions
  const getEventsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    return events.filter((event) => {
      const s = startOfDay(parseISO(event.startTime));
      const end = startOfDay(parseISO(event.endTime));
      return s <= dayStart && end >= dayStart && visibleFIRs.has(event.firCode);
    });
  };

  const getWeeklyEventsForDay = (day: Date) => {
    if (!showWeeklyEvents) return [];
    return weeklyEvents.filter((weeklyEvent) => {
      const eventDate = startOfDay(parseISO(weeklyEvent.date));
      const isSameDay = eventDate.toDateString() === day.toDateString();
      const firCode = weeklyEvent.config.fir?.code;
      return isSameDay && (firCode ? visibleFIRs.has(firCode) : true);
    });
  };

  const getBlockedDatesForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    return blockedDates.filter((blocked) => {
      const blockStart = startOfDay(parseISO(blocked.startDate));
      const blockEnd = startOfDay(parseISO(blocked.endDate));
      return dayStart >= blockStart && dayStart <= blockEnd;
    });
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setEditingBlockId(null);
    setBlockForm({
      startDate: format(day, "yyyy-MM-dd"),
      endDate: format(day, "yyyy-MM-dd"),
      startTime: "00:00",
      endTime: "23:59",
      reason: "",
      description: "",
    });
  };

  const handleEditBlockedDate = (blocked: BlockedDate) => {
    setEditingBlockId(blocked.id);
    setBlockForm({
      startDate: format(parseISO(blocked.startDate), "yyyy-MM-dd"),
      endDate: format(parseISO(blocked.endDate), "yyyy-MM-dd"),
      startTime: blocked.startTime || "",
      endTime: blocked.endTime || "",
      reason: blocked.reason,
      description: blocked.description || "",
    });
    setShowBlockDialog(true);
  };

  const handleBlockDate = async () => {
    if (!blockForm.startDate || !blockForm.endDate || !blockForm.reason) {
      setError("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const method = editingBlockId ? "PATCH" : "POST";
      const url = editingBlockId 
        ? `/api/calendar/blocked-dates/${editingBlockId}`
        : "/api/calendar/blocked-dates";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(blockForm.startDate).toISOString(),
          endDate: new Date(blockForm.endDate).toISOString(),
          startTime: blockForm.startTime || undefined,
          endTime: blockForm.endTime || undefined,
          reason: blockForm.reason,
          description: blockForm.description || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Fehler beim Speichern der Blockierung");
      }

      setShowBlockDialog(false);
      setEditingBlockId(null);
      setBlockForm({ startDate: "", endDate: "", startTime: "", endTime: "", reason: "", description: "" });
      fetchCalendarData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEvent = () => {
    if (selectedDate) {
      // Navigate to event creation page with pre-filled date
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      router.push(`/admin/events/create?date=${dateStr}`);
    }
  };

  const handleDeleteBlockedDate = async (id: number) => {
    if (!confirm("Blockierung wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/calendar/blocked-dates/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Fehler beim Löschen der Blockierung");
      }

      fetchCalendarData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Event Kalender
                </h1>
                <p className="text-sm text-muted-foreground">
                  Übersicht über alle geplanten Events und blockierten Daten.
                </p>
              </div>
            </div>
            {isVATGERLead() && (
              <Button onClick={() => setShowBlockDialog(true)} size="sm">
                <Ban className="mr-2 h-4 w-4" />
                Datum blockieren
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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

          {/* FIR filter chips + Weekly toggle */}
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
              onClick={() => setShowWeeklyEvents((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all
                ${showWeeklyEvents ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700" : "bg-muted text-muted-foreground border-transparent opacity-50"}`}
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
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const dayWeeklyEvents = getWeeklyEventsForDay(day);
                const dayBlocked = getBlockedDatesForDay(day);
                const inMonth = isSameMonth(day, currentMonth);
                const todayFlag = isToday(day);
                const totalItems = dayEvents.length + dayWeeklyEvents.length + dayBlocked.length;

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={`
                      min-h-[80px] sm:min-h-[100px] p-1.5 bg-background transition-colors cursor-pointer
                      ${inMonth ? "" : "bg-muted/30"}
                      ${totalItems > 0 ? "hover:bg-accent/50" : "hover:bg-muted/20"}
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

                    {/* Items */}
                    <div className="space-y-0.5 overflow-hidden">
                      {/* Blocked dates */}
                      {dayBlocked.slice(0, 1).map((blocked) => (
                        <div
                          key={blocked.id}
                          className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded truncate flex items-center gap-1"
                          title={`Blockiert: ${blocked.reason}`}
                        >
                          <Ban className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{blocked.reason}</span>
                        </div>
                      ))}

                      {/* Regular Events */}
                      {dayEvents.slice(0, Math.max(0, 2 - dayBlocked.length)).map((event) => {
                        const c = firColors(event.firCode);
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/events/${event.id}`);
                            }}
                            className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${c.bg} ${c.text} ${c.hover} cursor-pointer`}
                            title={event.name}
                          >
                            <span className={`hidden sm:inline-block shrink-0 text-[9px] font-bold px-1 py-0 rounded ${c.dot} text-white`}>
                              {event.firCode}
                            </span>
                            <span className="truncate leading-none">{event.name}</span>
                          </div>
                        );
                      })}

                      {/* Weekly Events */}
                      {(() => {
                        const shownCount = Math.min(dayBlocked.length, 1) + Math.min(dayEvents.length, Math.max(0, 2 - Math.min(dayBlocked.length, 1)));
                        const remaining = Math.max(0, 2 - shownCount);
                        return dayWeeklyEvents.slice(0, remaining).map((weeklyEvent) => {
                          const c = firColors(weeklyEvent.config.fir?.code);
                          return (
                            <div
                              key={`weekly-${weeklyEvent.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/weeklys/${weeklyEvent.config.id}/occurrences/${weeklyEvent.id}`);
                              }}
                              className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1 border border-dashed opacity-70 hover:opacity-100 ${c.bg} ${c.text} cursor-pointer`}
                              title={`${weeklyEvent.config.name} (Weekly)`}
                            >
                              <Repeat className="h-2.5 w-2.5 shrink-0 hidden sm:block" />
                              <span className="truncate leading-none italic">{weeklyEvent.config.name}</span>
                            </div>
                          );
                        });
                      })()}

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

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Legende:</span>
          {Object.entries(FIR_COLORS).map(([fir, c]) => (
            <span key={fir} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${c.dot}`} />
              {fir}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <Repeat className="h-3 w-3" />
            Weekly Event
          </span>
          <span className="flex items-center gap-1.5">
            <Ban className="h-3 w-3 text-red-600" />
            Blockiert
          </span>
        </div>
      </div>

      {/* Selected Date Dialog */}
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
                {getEventsForDay(selectedDate).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Events
                    </h3>
                    {getEventsForDay(selectedDate).map((event) => {
                      const c = firColors(event.firCode);
                      return (
                        <div
                          key={event.id}
                          onClick={() => router.push(`/admin/events/${event.id}`)}
                          className={`block p-3 rounded-lg border ${c.border} ${c.bg} ${c.hover} transition-colors cursor-pointer`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-medium truncate ${c.text}`}>{event.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(event.startTime).toLocaleTimeString("de-DE", {
                                  timeZone: "UTC",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}z
                                {" – "}
                                {new Date(event.endTime).toLocaleTimeString("de-DE", {
                                  timeZone: "UTC",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}z
                              </p>
                            </div>
                            <Badge className={`${c.dot} text-white text-[10px] px-1.5 py-0.5 border-0 shrink-0`}>
                              {event.firCode}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Weekly events */}
                {getWeeklyEventsForDay(selectedDate).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Repeat className="h-4 w-4" /> Weeklys
                    </h3>
                    {getWeeklyEventsForDay(selectedDate).map((weeklyEvent) => {
                      const firCode = weeklyEvent.config.fir?.code;
                      const c = firColors(firCode);
                      return (
                        <div
                          key={`weekly-${weeklyEvent.id}`}
                          onClick={() => router.push(`/weeklys/${weeklyEvent.config.id}/occurrences/${weeklyEvent.id}`)}
                          className={`block p-3 rounded-lg border border-dashed ${c.border} ${c.bg} ${c.hover} transition-colors cursor-pointer`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-medium italic truncate ${c.text}`}>{weeklyEvent.config.name}</p>
                              {(weeklyEvent.config.startTime || weeklyEvent.config.endTime) && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {weeklyEvent.config.startTime}
                                  {weeklyEvent.config.endTime && ` – ${weeklyEvent.config.endTime}`} Uhr
                                </p>
                              )}
                            </div>
                            {firCode && (
                              <Badge className={`${c.dot} text-white text-[10px] px-1.5 py-0.5 border-0 shrink-0`}>
                                {firCode}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Blocked dates */}
                {getBlockedDatesForDay(selectedDate).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Ban className="h-4 w-4 text-red-600" /> Blockierungen
                    </h3>
                    {getBlockedDatesForDay(selectedDate).map((blocked) => (
                      <div key={blocked.id} className="p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-red-800 dark:text-red-100">{blocked.reason}</div>
                            {blocked.description && (
                              <div className="text-sm text-red-600 dark:text-red-200 mt-1">
                                {blocked.description}
                              </div>
                            )}
                            <div className="text-xs text-red-500 dark:text-red-300 mt-1">
                              {format(parseISO(blocked.startDate), "dd.MM.yyyy")}
                              {blocked.startTime && ` ${blocked.startTime}z`}
                              {" – "}
                              {format(parseISO(blocked.endDate), "dd.MM.yyyy")}
                              {blocked.endTime && ` ${blocked.endTime}z`}
                            </div>
                          </div>
                          {isVATGERLead() && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditBlockedDate(blocked)}
                                aria-label="Blockierung bearbeiten"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBlockedDate(blocked.id)}
                                aria-label="Blockierung löschen"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {getEventsForDay(selectedDate).length === 0 &&
                  getWeeklyEventsForDay(selectedDate).length === 0 &&
                  getBlockedDatesForDay(selectedDate).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Events an diesem Tag.
                    </p>
                  )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setSelectedDate(null)}>
                  Schließen
                </Button>
                <Button onClick={handleCreateEvent}>
                  <Plus className="mr-2 h-4 w-4" />
                  Event erstellen
                </Button>
                {isVATGERLead() && (
                  <Button variant="outline" onClick={() => setShowBlockDialog(true)}>
                    <Ban className="mr-2 h-4 w-4" />
                    Blockieren
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Block Date Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={(open) => {
        setShowBlockDialog(open);
        if (!open) {
          setEditingBlockId(null);
          setError("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBlockId ? "Blockierung bearbeiten" : "Datum blockieren"}</DialogTitle>
            <DialogDescription>
              {editingBlockId 
                ? "Bearbeiten Sie die Blockierung eines Datums oder Zeitraums."
                : "Blockieren Sie ein Datum oder einen Zeitraum, an dem keine FIR ein Event planen soll."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Startdatum</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={blockForm.startDate}
                  onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Enddatum</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={blockForm.endDate}
                  onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Startzeit UTC (optional)</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={blockForm.startTime}
                  onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                  placeholder="HH:mm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Endzeit UTC (optional)</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={blockForm.endTime}
                  onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                  placeholder="HH:mm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Grund *</Label>
              <Input
                id="reason"
                placeholder="z.B. VATGER-weites Event"
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                placeholder="Zusätzliche Informationen..."
                value={blockForm.description}
                onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })}
                maxLength={1000}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowBlockDialog(false);
              setEditingBlockId(null);
              setError("");
            }} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={handleBlockDate} disabled={busy}>
              {busy ? (editingBlockId ? "Wird gespeichert..." : "Wird blockiert...") : (editingBlockId ? "Speichern" : "Blockieren")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}