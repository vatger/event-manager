"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  CalendarDays,
  Timer,
  Repeat,
  Plane,
} from "lucide-react";
import { format, isPast, isBefore, isAfter } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface FIR {
  code: string;
  name: string;
}

interface WeeklyOccurrence {
  id: number;
  date: string;
  signupDeadline: string | null;
  rosterPublishedAt: string | null;
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
}

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

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
    } catch (err) {
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

    const result: CalendarWeek[] = [];
    const startDate = new Date(config.startDate);
    
    // Get the earliest future or current occurrence
    const upcomingOccurrences = config.occurrences
      .filter((occ) => !isPast(new Date(occ.date)))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcomingOccurrences.length === 0) return [];

    // Start from first upcoming occurrence
    const firstOccurrence = upcomingOccurrences[0];
    const firstOccurrenceDate = new Date(firstOccurrence.date);
    
    // Calculate how many weeks to show (next 12 weeks)
    const weeksToShow = 12;
    
    // Create occurrence lookup map
    const occurrenceMap = new Map<string, WeeklyOccurrence>();
    upcomingOccurrences.forEach(occ => {
      const dateKey = new Date(occ.date).toISOString().split('T')[0];
      occurrenceMap.set(dateKey, occ);
    });

    // Generate calendar weeks by checking each week
    let currentDate = new Date(firstOccurrenceDate);
    
    for (let i = 0; i < weeksToShow; i++) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const occurrence = occurrenceMap.get(dateKey);
      
      if (occurrence) {
        // This week has an actual occurrence - show it as an active week
        result.push({
          type: "occurrence",
          date: new Date(currentDate),
          occurrence: occurrence,
        });
      } else {
        // No occurrence this week - it's a pause week
        result.push({
          type: "pause",
          date: new Date(currentDate),
        });
      }

      // Move to next week (same weekday)
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return result;
  };

  const isSignupOpen = (occurrence: WeeklyOccurrence): boolean => {
    if(occurrence.signupStatus === "closed") return false;
    if (!occurrence.signupDeadline) return true;
    const deadline = new Date(occurrence.signupDeadline);
    const twoWeeksBeforeDeadline = new Date(deadline);
    twoWeeksBeforeDeadline.setDate(deadline.getDate() - 14);
    return isBefore(new Date(), deadline) && isAfter(new Date(), twoWeeksBeforeDeadline);
  };

  const getSignupStatusMessage = (occurrence: WeeklyOccurrence): { text: string; color: string } => {
    if (!occurrence || !config?.requiresRoster) {
      return { text: "Kein Roster vorgesehen", color: "text-gray-500" };
    }
    
    if (occurrence.rosterPublishedAt) {
      return { text: "Roster veröffentlicht", color: "text-green-600" };
    }
    
    if (occurrence.signupStatus === "closed") {
      return { text: "Anmeldung geschlossen", color: "text-red-600" };
    }
    
    if (occurrence.signupStatus === "open") {
      if (occurrence.signupDeadline && !isBefore(new Date(), new Date(occurrence.signupDeadline))) {
        return { text: "Anmeldeschluss überschritten", color: "text-red-600" };
      }
      return { text: "Anmeldung offen", color: "text-green-600" };
    }
    
    // Auto mode
    if (occurrence.signupStatus === "auto") {
      const now = new Date();
      const occDate = new Date(occurrence.date);
      const twoWeeksBefore = new Date(occDate);
      twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);
      
      if (now < twoWeeksBefore) {
        const opensAtStr = twoWeeksBefore.toLocaleDateString("de-DE", { 
          day: "2-digit", 
          month: "2-digit", 
          year: "numeric" 
        });
        return { 
          text: `Noch keine Anmeldung`, 
          color: "text-amber-600" 
        };
      }
      
      if (occurrence.signupDeadline && !isBefore(now, new Date(occurrence.signupDeadline))) {
        return { text: "Anmeldeschluss überschritten", color: "text-red-600" };
      }
      
      return { text: "Anmeldung offen", color: "text-green-600" };
    }
    
    return { text: "Status unbekannt", color: "text-gray-500" };
  };

  const getStatusBadgeColor = (statusMessage: { text: string; color: string }): string => {
    if (statusMessage.color.includes("green")) return "bg-green-600";
    if (statusMessage.color.includes("amber")) return "bg-amber-600";
    if (statusMessage.color.includes("blue")) return "bg-blue-600";
    if (statusMessage.color.includes("red")) return "bg-red-600";
    return "";
  };

  const getAirportCount = (): number => {
    if (!config?.airports) return 0;
    return config.airports.length;
  };

  const getAirportText = (): string => {
    const count = getAirportCount();
    if (count === 0) return "";
    if (count === 1) return "Flughafen";
    return "Flughäfen";
  };

  const getPatternText = () => {
    if (!config) return "";
    if (config.weeksOff === 0) {
      return `Jede Woche`;
    }
    return `${config.weeksOn} ${config.weeksOn === 1 ? "Woche" : "Wochen"} aktiv, ${config.weeksOff} ${config.weeksOff === 1 ? "Woche" : "Wochen"} Pause`;
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl p-6">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="container mx-auto max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Event nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const upcomingOccurrences = config.occurrences.filter(
    (occ) => !isPast(new Date(occ.date))
  );

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => router.push("/weeklys")}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{config.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground">
              {config.fir?.name} ({config.fir?.code})
            </p>
            {!config.enabled && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                Deaktiviert
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Banner Image */}
      {config.bannerUrl && (
        <div className="relative w-full h-72 rounded-xl overflow-hidden border">
          <img
            src={config.bannerUrl}
            alt={`${config.name} Banner`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Event Details Card */}
      <Card className="border overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Event Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {config.description && (
            <div className="mb-5 pb-5 border-b">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {config.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wochentag */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Wochentag</p>
                <p className="font-medium">{WEEKDAYS[config.weekday]}</p>
              </div>
            </div>

            {/* Rhythmus */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-4 w-4 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Rhythmus</p>
                <p className="font-medium">{getPatternText()}</p>
              </div>
            </div>

            {/* Uhrzeit */}
            {(config.startTime || config.endTime) && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Uhrzeit (Lokalzeit)</p>
                  <p className="font-medium">{config.startTime || "?"} - {config.endTime || "?"}</p>
                </div>
              </div>
            )}

            {/* Flughäfen */}
            {config.airports && config.airports.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Plane className="h-4 w-4 text-purple-700" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {getAirportText()}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {config.airports.map((apt) => (
                      <Badge key={apt} variant="outline" className="font-mono text-xs">
                        {apt}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stationen */}
          {config.requiresRoster && config.staffedStations && config.staffedStations.length > 0 && (
            <div className="mt-5 pt-5 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Zu besetzende Stationen</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {config.staffedStations.map((station) => (
                  <Badge key={station} variant="outline" className="py-1">
                    {station}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Occurrences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Kommende Termine</h2>
            <Badge variant="outline" className="ml-2">
              Nächste 12 Wochen
            </Badge>
          </div>
        </div>

        {(() => {
          const calendarWeeks = generateCalendarWeeks();
          
          if (calendarWeeks.length === 0) {
            return (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                    <Calendar className="h-6 w-6 text-muted-foreground/50" />
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

                // Formatierungen
                const dayOfMonth = format(occDate, "dd");
                const month = MONTHS[occDate.getMonth()];
                const weekday = WEEKDAYS[occDate.getDay()];
                const formattedDate = format(occDate, "dd.MM.yyyy", { locale: de });

                if (week.type === "pause" && config.weeksOff > 0) {
                  // Pause week placeholder
                  return (
                    <div
                      key={`pause-${occDate.getTime()}`}
                      className="block"
                    >
                      <div className="flex items-stretch border border-dashed rounded-lg overflow-hidden bg-muted/20 opacity-60">
                        {/* Datum-Block */}
                        <div className="w-24 flex flex-col items-center justify-center py-3 border-r border-dashed bg-muted/30">
                          <span className="text-2xl font-bold leading-none text-muted-foreground">{dayOfMonth}</span>
                          <span className="text-xs font-medium uppercase tracking-wider mt-1 text-muted-foreground">{month}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{weekday}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 flex items-center justify-center">
                          <div className="text-center">
                            <div className="flex items-center gap-2 justify-center mb-1">
                              <Repeat className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground">Pause Woche</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formattedDate} - Kein Event
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Active week with occurrence
                const occurrence = week.occurrence;
                if (!occurrence) {
                  // Shouldn't happen, but handle gracefully
                  return null;
                }

                const deadline = occurrence.signupDeadline
                  ? new Date(occurrence.signupDeadline)
                  : null;
                const signupOpen = isSignupOpen(occurrence);

                return (
                  <Link
                    key={occurrence.id}
                    href={`/weeklys/${config.id}/occurrences/${occurrence.id}`}
                    className="block group"
                  >
                    <div className={cn(
                      "flex items-stretch border rounded-lg overflow-hidden transition-all hover:border-primary/30 hover:shadow-sm",
                      isFirst && "border-primary/20 bg-primary/5"
                    )}>
                      {/* Datum-Block */}
                      <div className={cn(
                        "w-24 flex flex-col items-center justify-center py-3 border-r",
                        isFirst ? "bg-primary/10" : "bg-muted/20"
                      )}>
                        <span className="text-2xl font-bold leading-none">{dayOfMonth}</span>
                        <span className="text-xs font-medium uppercase tracking-wider mt-1">{month}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{weekday}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-base">
                                {formattedDate}
                              </h3>
                            </div>
                            
                            {config.startTime && config.endTime && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{config.startTime} - {config.endTime} Uhr</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {config.requiresRoster && (
                              <Badge 
                              variant={signupOpen ? "default" : "secondary"}
                              className={cn(
                                getStatusBadgeColor(getSignupStatusMessage(occurrence))
                              )}
                            >
                              {getSignupStatusMessage(occurrence).text}
                            </Badge>
                            )}
                            
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-3 text-sm gap-1"
                            >
                              Details
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}