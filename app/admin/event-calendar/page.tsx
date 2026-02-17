"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Clock,
  Pencil,
  Trash2,
  TrashIcon,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO } from "date-fns";
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

// FIR Farben
const FIR_COLORS = {
  EDMM: {
    bg: "bg-blue-100 dark:bg-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-700",
    border: "border-blue-200 dark:border-blue-700",
    badge: "bg-blue-600 text-white",
  },
  EDGG: {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    text: "text-emerald-700 dark:text-emerald-300",
    hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900",
    border: "border-emerald-200 dark:border-emerald-800",
    badge: "bg-emerald-600 text-white",
  },
  EDWW: {
    bg: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-300",
    hover: "hover:bg-amber-100 dark:hover:bg-amber-900",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-600 text-white",
  },
};

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
    setVisibleFIRs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fir)) {
        newSet.delete(fir);
      } else {
        newSet.add(fir);
      }
      return newSet;
    });
  };

  // Fetch events and blocked dates
  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      // Fetch events for the current month
      const eventsRes = await fetch("/api/events");
      if (eventsRes.ok) {
        const allEvents: Event[] = await eventsRes.json();
        // Filter events that fall within or overlap the current month
        const monthEvents = allEvents.filter(event => {
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
      const weeklyRes = await fetch("/api/weeklys/upcoming");
      if (weeklyRes.ok) {
        const allWeeklyEvents: WeeklyEvent[] = await weeklyRes.json();
        // Filter to current month
        const monthWeeklyEvents = allWeeklyEvents.filter(weeklyEvent => {
          const eventDate = parseISO(weeklyEvent.date);
          return eventDate >= monthStart && eventDate <= monthEnd;
        });
        setWeeklyEvents(monthWeeklyEvents);
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

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Helper functions
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.startTime);
      const eventEnd = parseISO(event.endTime);
      const isInRange = day >= new Date(eventStart.toDateString()) && day <= new Date(eventEnd.toDateString());
      const isVisible = visibleFIRs.has(event.firCode);
      return isInRange && isVisible;
    });
  };

  const getWeeklyEventsForDay = (day: Date) => {
    if (!showWeeklyEvents) return [];
    
    return weeklyEvents.filter(weeklyEvent => {
      const eventDate = parseISO(weeklyEvent.date);
      const isSameDay = day.toDateString() === eventDate.toDateString();
      const firCode = weeklyEvent.config.fir?.code;
      const isVisible = firCode ? visibleFIRs.has(firCode) : true;
      return isSameDay && isVisible;
    });
  };

  const getBlockedDatesForDay = (day: Date) => {
    return blockedDates.filter(blocked => {
      const blockStart = parseISO(blocked.startDate);
      const blockEnd = parseISO(blocked.endDate);
      return day >= new Date(blockStart.toDateString()) && day <= new Date(blockEnd.toDateString());
    });
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Event Kalender</h1>
          <p className="text-muted-foreground mt-1">
            Übersicht über alle geplanten Events und blockierten Daten.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleToday} variant="outline">
            <Clock className="mr-2 h-4 w-4" />
            Heute
          </Button>
          {isVATGERLead() && (
            <Button onClick={() => setShowBlockDialog(true)}>
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

      

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button onClick={handlePreviousMonth} variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-2xl">
              {format(currentMonth, "MMMM yyyy", { locale: de })}
            </CardTitle>
            <Button onClick={handleNextMonth} variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const dayEvents = getEventsForDay(day);
                  const dayWeeklyEvents = getWeeklyEventsForDay(day);
                  const dayBlocked = getBlockedDatesForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(day)}
                      className={`
                        min-h-24 p-2 border rounded-lg cursor-pointer transition-colors
                        ${isCurrentMonth ? "bg-background" : "bg-muted/50"}
                        ${isCurrentDay ? "border-primary border-2" : "border-border"}
                        hover:bg-accent hover:border-accent-foreground
                      `}
                    >
                      <div className="flex flex-col h-full">
                        <div className={`text-sm font-medium mb-1 ${!isCurrentMonth && "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </div>
                        
                        <div className="flex-1 space-y-1 overflow-hidden">
                          {dayBlocked.map((blocked) => (
                            <div
                              key={blocked.id}
                              className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded truncate flex items-center"
                              title={`Blockiert: ${blocked.reason}`}
                            >
                              <Ban className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{blocked.reason}</span>
                            </div>
                          ))}
                          
                          {/* Regular Events */}
                          {dayEvents.slice(0, 2).map((event) => {
                            const colors = FIR_COLORS[event.firCode as keyof typeof FIR_COLORS] || FIR_COLORS.EDMM;
                            return (
                              <div
                                key={event.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin/events/${event.id}`);
                                }}
                                className={`text-xs px-1.5 py-0.5 rounded truncate ${colors.bg} ${colors.text} ${colors.hover} flex items-center gap-1`}
                                title={event.name}
                              >
                                <Badge variant="outline" className={`px-1 py-0 text-[10px] h-4 ${colors.badge} border-0`}>
                                  {event.firCode}
                                </Badge>
                                <span className="truncate">{event.name}</span>
                              </div>
                            );
                          })}
                          
                          {/* Weekly Events - Displayed with subdued styling */}
                          {dayWeeklyEvents.slice(0, 2 - Math.min(dayEvents.length, 2)).map((weeklyEvent) => {
                            const firCode = weeklyEvent.config.fir?.code || "EDMM";
                            const colors = FIR_COLORS[firCode as keyof typeof FIR_COLORS] || FIR_COLORS.EDMM;
                            return (
                              <div
                                key={`weekly-${weeklyEvent.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/weeklys/${weeklyEvent.config.id}/occurrences/${weeklyEvent.id}`);
                                }}
                                className={`text-xs px-1.5 py-0.5 rounded truncate border border-dashed opacity-60 hover:opacity-100 ${colors.bg} ${colors.text} flex items-center gap-1`}
                                title={`${weeklyEvent.config.name} (Weekly)`}
                              >
                                <Badge variant="outline" className={`px-1 py-0 text-[10px] h-4 ${colors.badge} border-0 opacity-80`}>
                                  {firCode}
                                </Badge>
                                <span className="truncate italic">{weeklyEvent.config.name}</span>
                              </div>
                            );
                          })}
                          
                          {(dayEvents.length + dayWeeklyEvents.length) > 2 && (
                            <div className="text-xs text-muted-foreground px-1.5">
                              +{dayEvents.length + dayWeeklyEvents.length - 2} weitere
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FIR Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* FIR Filter */}
          <div>
            <h3 className="text-sm font-medium mb-2">FIR</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FIR_COLORS).map(([fir, colors]) => (
                <Button
                  key={fir}
                  variant={visibleFIRs.has(fir) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFIR(fir)}
                  className={visibleFIRs.has(fir) ? colors.badge : ""}
                >
                  {fir}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Weekly Events Toggle */}
          <div>
            <h3 className="text-sm font-medium mb-2">Event Typen</h3>
            <div className="flex gap-2">
              <Button
                variant={showWeeklyEvents ? "default" : "outline"}
                size="sm"
                onClick={() => setShowWeeklyEvents(!showWeeklyEvents)}
              >
                Weekly Events
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Selected Date Dialog */}
      {selectedDate && (
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{format(selectedDate, "EEEE, d. MMMM yyyy", { locale: de })}</DialogTitle>
              <DialogDescription>
                Wie schauts an diesem Tag aus?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Show events for this day */}
              {getEventsForDay(selectedDate).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Events an diesem Tag:</h4>
                  <div className="space-y-2">
                    {getEventsForDay(selectedDate).map((event) => {
                      const colors = FIR_COLORS[event.firCode as keyof typeof FIR_COLORS] || FIR_COLORS.EDMM;
                      return (
                        <div
                          key={event.id}
                          onClick={() => router.push(`/admin/events/${event.id}`)}
                          className={`p-3 border rounded-lg cursor-pointer ${colors.border} ${colors.bg} ${colors.hover}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className={`font-medium ${colors.text}`}>{event.name}</div>
                              <div className="text-sm opacity-80">
                                {(new Date(event.startTime).toLocaleTimeString("de-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }))}z - 
                                {(new Date(event.endTime).toLocaleTimeString("de-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }))}z
                              </div>
                            </div>
                            <Badge className={colors.badge}>{event.firCode}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show weekly events for this day */}
              {getWeeklyEventsForDay(selectedDate).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Weekly Events an diesem Tag:</h4>
                  <div className="space-y-2">
                    {getWeeklyEventsForDay(selectedDate).map((weeklyEvent) => {
                      const firCode = weeklyEvent.config.fir?.code || "EDMM";
                      const colors = FIR_COLORS[firCode as keyof typeof FIR_COLORS] || FIR_COLORS.EDMM;
                      return (
                        <div
                          key={`weekly-${weeklyEvent.id}`}
                          onClick={() => router.push(`/weeklys/${weeklyEvent.config.id}/occurrences/${weeklyEvent.id}`)}
                          className={`p-3 border border-dashed rounded-lg cursor-pointer ${colors.border} ${colors.bg} ${colors.hover} opacity-80 hover:opacity-100`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className={`font-medium ${colors.text} flex items-center gap-2`}>
                                <span className="italic">{weeklyEvent.config.name}</span>
                                <span className="text-xs opacity-60">(Weekly)</span>
                              </div>
                              {weeklyEvent.config.startTime && weeklyEvent.config.endTime && (
                                <div className="text-sm opacity-80">
                                  {weeklyEvent.config.startTime} - {weeklyEvent.config.endTime} Uhr
                                </div>
                              )}
                            </div>
                            <Badge className={colors.badge}>{firCode}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show blocked dates for this day */}
              {getBlockedDatesForDay(selectedDate).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Blockierungen:</h4>
                  <div className="space-y-2">
                    {getBlockedDatesForDay(selectedDate).map((blocked) => (
                      <div key={blocked.id} className="p-3 border border-red-200 bg-red-50 dark:bg-red-950 dark:border-border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-red-800 dark:text-red-100">{blocked.reason}</div>
                            {blocked.description && (
                              <div className="text-sm text-red-600 dark:text-red-200 mt-1">
                                {blocked.description}
                              </div>
                            )}
                            <div className="text-xs text-red-500 dark:text-red-300 mt-1">
                              {format(parseISO(blocked.startDate), "dd.MM.yyyy")}
                              {blocked.startTime && ` ${blocked.startTime}z`}
                              {" - "}
                              {format(parseISO(blocked.endDate), "dd.MM.yyyy")}
                              {blocked.endTime && ` ${blocked.endTime}z`}
                            </div>
                          </div>
                          {isVATGERLead() && (
                            <div className="flex gap-2">
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
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDate(null)}>
                Schließen
              </Button>
              <Button onClick={handleCreateEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Event erstellen
              </Button>
              {isVATGERLead() && (
                <Button onClick={() => setShowBlockDialog(true)}>
                  <Ban className="mr-2 h-4 w-4" />
                  Datum blockieren
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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