"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence } from "framer-motion";
import SignupForm from "@/components/SignupForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEventSignup } from "@/hooks/useEventSignup";
import { stationsConfig, StationGroup } from "@/data/station_configs";
import SignupsTable from "@/components/SignupsTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar, Clock, MapPin, Users } from "lucide-react";
import Image from "next/image";
import { EventSignup } from "@prisma/client";

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

interface Event {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  airports: string;
  startTime: string;
  endTime: string;
  staffedStations: string[];
  signupDeadline: string;
  registrations: number;
  isSignedUp?: boolean;
  status: "DRAFT" | "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "CANCELLED";
}

 type TimeRange = { start: string; end: string };

 type Signup = {
  id: string | number;
  userCID?: string | number;
  user?: { cid?: string | number; name?: string };
  endorsement?: string | null;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  preferredStations?: string | null;
  remarks?: string | null;
};


// Helper functions
const callsignToGroup: Record<string, StationGroup> = Object.fromEntries(
  stationsConfig.map((s) => [s.callsign, s.group])
);

const callsignOrder: Record<string, number> = Object.fromEntries(
  stationsConfig.map((s, idx) => [s.callsign, idx])
);

const formatTimeZ = (dateIso?: string | Date): string => {
  if (!dateIso) return "-";
  const d = new Date(dateIso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}z`;
};

const groupByConfig = (stations: string[]): Record<string, string[]> => {
  return stations.reduce((acc: Record<string, string[]>, cs) => {
    const grp = callsignToGroup[cs] ?? cs.slice(-3);
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(cs);
    return acc;
  }, {});
};

export default function EventPage() {
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const userCID = session?.user.id;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [signupsError, setSignupsError] = useState("");

  // Event laden
  useEffect(() => {
    if (!id) return;
    
    setEventLoading(true);
    setEventError("");

    fetch(`/api/events/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Fehler beim Laden des Events");
        }
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => {
        console.error("Event loading error:", err);
        setEventError(err.message || "Fehler beim Laden des Events");
      })
      .finally(() => setEventLoading(false));
  }, [id]);

  // Signups laden
  const loadSignups = useMemo(() => () => {
    if (!id) return;
    
    setSignupsLoading(true);
    setSignupsError("");

    fetch(`/api/events/${id}/signup`)
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden der Anmeldungen");
        return res.json();
      })
      .then((data) => setSignups(data))
      .catch((err) => {
        console.error("Signups loading error:", err);
        setSignupsError("Fehler beim Laden der Anmeldungen");
      })
      .finally(() => setSignupsLoading(false));
  }, [id]);

  useEffect(() => {
    loadSignups();
  }, [loadSignups]);

  const eventId = event?.id ?? id;
  const { loading: signupLoading, isSignedUp, signupData, refetch } = useEventSignup(eventId, Number(userCID));

  const groupedStations = useMemo(() => {
    if (!event?.staffedStations) return [];
    
    const grouped = groupByConfig(event.staffedStations);
    return Object.entries(grouped)
      .sort(([a], [b]) => (PRIORITY[a] ?? Number.POSITIVE_INFINITY) - (PRIORITY[b] ?? Number.POSITIVE_INFINITY))
      .map(([area, stations]) => [
        area,
        stations.sort((a, b) => (callsignOrder[a] ?? Number.POSITIVE_INFINITY) - (callsignOrder[b] ?? Number.POSITIVE_INFINITY))
      ]);
  }, [event?.staffedStations]);

  const dateLabel = useMemo(() => 
    event ? new Date(event.startTime).toLocaleDateString("de-DE") : "", 
    [event?.startTime]
  );

  const timeLabel = useMemo(() => 
    event ? `${formatTimeZ(event.startTime)} - ${formatTimeZ(event.endTime)}` : "", 
    [event?.startTime, event?.endTime]
  );

  const airportsLabel = useMemo(() => 
    event ? (Array.isArray(event.airports) ? event.airports.join(", ") : String(event.airports ?? "-")) : "", 
    [event?.airports]
  );

  const normalizedEventForSignup = useMemo(() => 
    event ? {
      ...event,
      airports: Array.isArray(event.airports) ? event.airports[0] : event.airports,
    } : null,
    [event]
  );

  const getStatusBadgeVariant = (status: Event["status"]) => {
    switch (status) {
      case "SIGNUP_OPEN":
        return "default";
      case "PLANNING":
      case "DRAFT":
        return "secondary";
      case "ROSTER_PUBLISHED":
        return "outline";
      case "CANCELLED":
        return "destructive";
      case "SIGNUP_CLOSED":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (eventLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-3/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Skeleton className="md:col-span-2 h-64 md:h-auto rounded-xl" />
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {eventError || "Event nicht gefunden"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Event Info Card */}
        <Card className="md:col-span-1 order-2 md:order-1 h-fit">
          <CardHeader className="relative">
            <CardTitle>Event Informationen</CardTitle>
            <div className="absolute right-4">
              <Badge variant={getStatusBadgeVariant(event.status)}>
                {event.status.replace("_", " ").toLowerCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{dateLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{timeLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{airportsLabel}</span>
              </div>
            </div>

            {event.description && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{event.description}</p>
              </div>
            )}

            {event.status === "PLANNING" || event.status === "DRAFT" ? (
              <Button className="w-full" variant="secondary" disabled>
                Noch nicht geöffnet
              </Button>
            ) : event.status === "SIGNUP_OPEN" ? (
              signupLoading ? (
                <Button className="w-full" disabled>
                  Laden...
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedEvent(normalizedEventForSignup)}
                >
                  {isSignedUp ? "Anmeldung bearbeiten" : "Jetzt anmelden"}
                </Button>
              )
            ) : event.status === "ROSTER_PUBLISHED" ? (
              <Button className="w-full">
                Besetzungsplan anzeigen
              </Button>
            ) : event.status === "CANCELLED" ? (
              <Button className="w-full" variant="destructive" disabled>
                Event abgesagt
              </Button>
            ) : event.status === "SIGNUP_CLOSED" ? (
              <Button className="w-full" variant="secondary" disabled>
                Anmeldung geschlossen
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Event Banner */}
        <div className="md:col-span-2 order-1 md:order-2 min-h-0">
          {/* Mobile: fixe Höhe, Desktop: exakt so hoch wie die Card */}
          <div className="relative h-56 md:h-full rounded-2xl overflow-hidden">
            <img
              src={event.bannerUrl}
              alt="Event Banner"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          </div>
        </div>
        </div>

      {(event.status === "SIGNUP_OPEN" || event.status === "SIGNUP_CLOSED" || event.status === "ROSTER_PUBLISHED") && (
        <Card>
          <CardHeader>
            <CardTitle>Zu besetzende Stationen</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={groupedStations[0]?.[0] as string|| "GND"} className="w-full">
              <TabsList className="flex flex-wrap gap-2 bg-muted/50 p-1 rounded-lg w-full">
                {groupedStations.map(([area, stations]) => (
                  <TabsTrigger
                    key={area as string}
                    value={area as string}
                    className="rounded-md px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition"
                  >
                    {area as string}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({(stations as string[]).length})
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {groupedStations.map(([area, stations]) => (
                <TabsContent key={area as string} value={area as string}>
                  <div className="flex flex-wrap gap-2">
                    {(stations as string[]).map((station) => (
                      <Badge key={station} variant="secondary" className="px-2.5 py-1 rounded-md">
                        {station}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Teilnehmer Tabelle */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Angemeldete Teilnehmer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignupsTable
            signups={signups}
            loading={signupsLoading}
            error={signupsError}
            columns={["cid", "name", "availability", "remarks"]}
          />
        </CardContent>

        {event.status === "ROSTER_PUBLISHED" && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Besetzungsplan ist verfügbar!</h3>
              <p className="text-muted-foreground">Der finale Besetzungsplan wurde veröffentlicht.</p>
            </div>
            <Button size="lg">Zum Besetzungsplan</Button>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {selectedEvent && (
          <SignupForm
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onChanged={() => { 
              refetch(); 
              loadSignups(); 
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}