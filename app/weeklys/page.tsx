"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2 } from "lucide-react";
import { format, isFuture, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { formatWeeklyEventsWithPauses } from "@/lib/weeklyEventsFormatter";

interface WeeklyEventOccurrence {
  id: number;
  date: string;
  config: {
    id: number;
    name: string;
    weekday: number;
    weeksOn: number;
    weeksOff: number;
    startDate: string;
  };
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

export default function PublicWeeklyEventsPage() {
  const [occurrences, setOccurrences] = useState<WeeklyEventOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOccurrences();
  }, []);

  const fetchOccurrences = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weeklys/upcoming");
      if (res.ok) {
        const data = await res.json();
        setOccurrences(data);
      } else {
        setError("Fehler beim Laden der Termine");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  const getDateStatus = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return { label: "Heute", variant: "default" as const };
    if (isPast(date)) return { label: "Vergangen", variant: "secondary" as const };
    if (isFuture(date)) return { label: "Bevorstehend", variant: "outline" as const };
    return { label: "", variant: "outline" as const };
  };

  // Group occurrences by event name
  const groupedByEvent = occurrences.reduce((acc, occ) => {
    const eventName = occ.config.name;
    if (!acc[eventName]) {
      acc[eventName] = [];
    }
    acc[eventName].push(occ);
    return acc;
  }, {} as Record<string, WeeklyEventOccurrence[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Wöchentliche Events</h1>
        <p className="text-muted-foreground mt-1">
          Übersicht aller geplanten wöchentlichen Events
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : Object.keys(groupedByEvent).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Keine wöchentlichen Events geplant
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByEvent).map(([eventName, eventOccurrences]) => {
            const config = eventOccurrences[0].config;
            const formattedDates = formatWeeklyEventsWithPauses(eventOccurrences);

            return (
              <Card key={eventName}>
                <CardHeader>
                  <CardTitle>{eventName}</CardTitle>
                  <CardDescription>
                    Rhythmus: {config.weeksOn} Woche(n) Event, {config.weeksOff} Woche(n) Pause
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {formattedDates.map((entry, index) => {
                      if (entry.type === "pause") {
                        return (
                          <div
                            key={`pause-${index}`}
                            className="flex items-center justify-center p-3 border-2 border-dashed rounded-lg bg-muted/50"
                          >
                            <p className="font-medium text-muted-foreground italic">
                              {entry.label}
                            </p>
                          </div>
                        );
                      }

                      const status = getDateStatus(entry.date!.toISOString());
                      const weekday = WEEKDAYS[entry.date!.getDay()];

                      return (
                        <div
                          key={`event-${index}`}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="font-medium text-lg">
                                {entry.formattedDate}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {weekday}
                              </p>
                            </div>
                          </div>
                          {status.label && (
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
