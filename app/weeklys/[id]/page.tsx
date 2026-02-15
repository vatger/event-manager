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
} from "lucide-react";
import { format, isPast, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/weeklys")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{config.name}</h1>
          <p className="text-muted-foreground">
            {config.fir?.name} ({config.fir?.code})
          </p>
        </div>
      </div>

      {/* Weekly Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.description && (
            <div>
              <h3 className="font-semibold mb-2">Beschreibung</h3>
              <p className="text-muted-foreground">{config.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Wochentag</p>
                <p className="text-sm text-muted-foreground">
                  Jeden {WEEKDAYS[config.weekday]}
                </p>
              </div>
            </div>

            {(config.startTime || config.endTime) && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Uhrzeit (UTC)</p>
                  <p className="text-sm text-muted-foreground">
                    {config.startTime || "?"} - {config.endTime || "?"}
                  </p>
                </div>
              </div>
            )}

            {config.airports && config.airports.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Flughäfen</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config.airports.join(", ")}
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-1">Rhythmus</p>
              <Badge variant="secondary">
                {config.weeksOn} Woche(n) aktiv, {config.weeksOff} Woche(n) Pause
              </Badge>
            </div>
          </div>

          {config.requiresRoster && config.staffedStations && config.staffedStations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Zu besetzende Stationen</h3>
              <div className="flex flex-wrap gap-2">
                {config.staffedStations.map((station) => (
                  <Badge key={station} variant="outline">
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
        <h2 className="text-2xl font-semibold">Kommende Termine</h2>

        {upcomingOccurrences.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Keine kommenden Termine</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {upcomingOccurrences.map((occurrence) => {
              const occDate = new Date(occurrence.date);
              const deadline = occurrence.signupDeadline
                ? new Date(occurrence.signupDeadline)
                : null;
              const signupOpen = isSignupOpen(occurrence);

              return (
                <Link
                  key={occurrence.id}
                  href={`/weeklys/${config.id}/occurrences/${occurrence.id}`}
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between p-6">
                      <div className="flex items-center gap-4">
                        <Calendar className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-semibold text-lg">
                            {format(occDate, "EEEE, dd. MMMM yyyy", { locale: de })}
                          </p>
                          {config.startTime && config.endTime && (
                            <p className="text-sm text-muted-foreground">
                              {config.startTime} - {config.endTime} UTC
                            </p>
                          )}
                          {deadline && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Anmeldeschluss:{" "}
                              {format(deadline, "dd.MM.yyyy HH:mm", { locale: de })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {config.requiresRoster && (
                          <>
                            {signupOpen ? (
                              <Badge variant="default">Anmeldung offen</Badge>
                            ) : (
                              <Badge variant="secondary">Anmeldung geschlossen</Badge>
                            )}
                          </>
                        )}
                        {!config.requiresRoster && (
                          <Badge variant="outline">Kein Roster</Badge>
                        )}
                        <Button variant="ghost" size="sm">
                          Details ansehen →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
