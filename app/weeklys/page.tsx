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
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, MapPin, Clock } from "lucide-react";
import { format, isFuture, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FIR {
  code: string;
  name: string;
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
  bannerUrl?: string | null; // Added for banner image URL
  requiresRoster?: boolean;
  staffedStations?: string[];
  enabled: boolean;
}

interface WeeklyEventOccurrence {
  id: number;
  date: string;
  configId: number;
  signupDeadline: string | null;
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
  const [configs, setConfigs] = useState<WeeklyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchWeeklyConfigs();
  }, []);

  const fetchWeeklyConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/weeklys");
      if (res.ok) {
        const data = await res.json();
        // Filter only enabled configs
        const enabledConfigs = data.filter((c: WeeklyConfig) => c.enabled);
        setConfigs(enabledConfigs);
      } else {
        setError("Fehler beim Laden der wöchentlichen Events");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  };

  // Group configs by FIR
  const configsByFir = configs.reduce((acc, config) => {
    const firCode = config.fir?.code || "Andere";
    const firName = config.fir?.name || "Andere";
    const key = `${firCode}|${firName}`;
    
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(config);
    return acc;
  }, {} as Record<string, WeeklyConfig[]>);

  const parseAirports = (airports: string[] | string | null | undefined): string[] => {
    if (!airports) return [];
    if (Array.isArray(airports)) return airports;
    if (typeof airports === "string") {
      try {
        return JSON.parse(airports);
      } catch {
        return [];
      }
    }
    return [];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Wöchentliche Events</h1>
        <p className="text-muted-foreground mt-1">
          Übersicht aller wiederkehrenden wöchentlichen Events
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
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Keine wöchentlichen Events verfügbar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(configsByFir).map(([firKey, firConfigs]) => {
            const [firCode, firName] = firKey.split("|");
            
            return (
              <div key={firKey} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold">
                    {firName} ({firCode})
                  </h2>
                  <Badge variant="outline">{firConfigs.length} Event{firConfigs.length !== 1 ? "s" : ""}</Badge>
                </div>
                
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {firConfigs.map((config) => {
                    const airports = parseAirports(config.airports);
                    
                    return (
                      <Link href={`/weeklys/${config.id}`} key={config.id}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                          {config.bannerUrl && (
                            <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
                              <img
                                src={config.bannerUrl}
                                alt={`${config.name} Banner`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <span>{config.name}</span>
                            </CardTitle>
                            <CardDescription>
                              {config.weeksOff == 0 ? (
                               "Jeden " + WEEKDAYS[config.weekday]
                              ) : (
                                WEEKDAYS[config.weekday] + "s"
                              )}
                              
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {config.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {config.description}
                              </p>
                            )}
                            
                            {airports.length > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">{airports.join(", ")}</span>
                              </div>
                            )}
                            
                            {(config.startTime || config.endTime) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {config.startTime || "?"} - {config.endTime || "?"} Uhr
                                </span>
                              </div>
                            )}
                            
                            <div className="pt-2">
                              <Badge variant="secondary" className="text-xs">
                                {config.weeksOn} Woche(n) aktiv, {config.weeksOff} Woche(n) Pause
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
