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
import { format, isPast, isBefore } from "date-fns";
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

  const isSignupOpen = (occurrence: WeeklyOccurrence): boolean => {
    if (!occurrence.signupDeadline) return true;
    return isBefore(new Date(), new Date(occurrence.signupDeadline));
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Uhrzeit (UTC)</p>
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
              {upcomingOccurrences.length}
            </Badge>
          </div>
        </div>

        {upcomingOccurrences.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Keine kommenden Termine</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingOccurrences.map((occurrence, index) => {
              const occDate = new Date(occurrence.date);
              const deadline = occurrence.signupDeadline
                ? new Date(occurrence.signupDeadline)
                : null;
              const signupOpen = isSignupOpen(occurrence);
              const isFirst = index === 0;

              // Formatierungen
              const dayOfMonth = format(occDate, "dd");
              const month = MONTHS[occDate.getMonth()];
              const weekday = WEEKDAYS[occDate.getDay()];
              const formattedDate = format(occDate, "dd.MM.yyyy", { locale: de });

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
                            {deadline && (
                              <span className="text-xs text-muted-foreground">
                                Anmeldeschluss: {format(deadline, "dd.MM.yyyy HH:mm")}
                              </span>
                            )}
                          </div>
                          
                          {config.startTime && config.endTime && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{config.startTime} - {config.endTime} UTC</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {config.requiresRoster && (
                            <Badge 
                              variant={signupOpen ? "default" : "secondary"}
                              className={cn(
                                "text-xs px-2 py-0.5",
                                signupOpen && "bg-green-600"
                              )}
                            >
                              {signupOpen ? "Anmeldung offen" : "Anmeldung geschlossen"}
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
        )}
      </div>
    </div>
  );
}