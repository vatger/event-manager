"use client"

import SignupForm from "@/components/SignupForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEventSignup } from "@/hooks/useEventSignup"
import { AnimatePresence } from "framer-motion"
import { useSession } from "next-auth/react"
import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { stationsConfig, StationGroup } from "@/data/station_configs"
import SignupsTable from "@/components/SignupsTable"


const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

// Gruppiere Stations nach der Config (Fallback: Suffix)
const callsignToGroup: Record<string, StationGroup> = Object.fromEntries(
  stationsConfig.map((s) => [s.callsign, s.group])
)

const callsignOrder: Record<string, number> = Object.fromEntries(
  stationsConfig.map((s, idx) => [s.callsign, idx])
)

function groupByConfig(stations: string[]) {
  return stations.reduce((acc: Record<string, string[]>, cs) => {
    const grp = callsignToGroup[cs] ?? cs.slice(-3)
    if (!acc[grp]) acc[grp] = []
    acc[grp].push(cs)
    return acc
  }, {})
}

function formatTimeZ(dateIso?: string | Date) {
  if (!dateIso) return "-";
  const d = new Date(dateIso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
}

export default function EventPage(){
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const userCID = session?.user.id;

  const [event, setEvent] = useState<any | null>(null);
  const [eventLoading, setEventLoading] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string>("");

  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [signupsLoading, setSignupsLoading] = useState<boolean>(false);
  const [signupsError, setSignupsError] = useState<string>("");

  // Event laden
  useEffect(() => {
    if (!id) return;
    setEventLoading(true);
    setEventError("");

    fetch(`/api/events/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Fehler beim Laden des Events");
        }
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => {
        console.error(err);
        setEventError(err.message || "Fehler beim Laden des Events");
      })
      .finally(() => setEventLoading(false));
  }, [id]);

  // Signups laden
  const loadSignups = () => {
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
        console.error(err);
        setSignupsError("Fehler beim Laden der Anmeldungen");
      })
      .finally(() => setSignupsLoading(false));
  };

  useEffect(() => {
    loadSignups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const eventId = event?.id ?? id;
  const { loading, isSignedUp, signupData, refetch } = useEventSignup(eventId, Number(userCID));

  if (eventLoading) return <p className="p-6 text-center">Laden...</p>;
  if (eventError) return <p className="p-6 text-center text-red-500">{eventError}</p>;
  if (!event) return <p className="p-6 text-center">Event nicht gefunden</p>;

  const grouped = groupByConfig(event?.staffedStations || []);
  const sortedgrouped = Object.entries(grouped)
    .sort( ([a], [b]) => (PRIORITY[a] ?? Number.POSITIVE_INFINITY) - (PRIORITY[b] ?? Number.POSITIVE_INFINITY) )
    .map(([area, stations]) => [
      area,
      stations.sort((a, b) => (callsignOrder[a] ?? Number.POSITIVE_INFINITY) - (callsignOrder[b] ?? Number.POSITIVE_INFINITY))
    ]);
  const dateLabel = new Date(event.startTime).toLocaleDateString("de-DE");
  const timeLabel = `${formatTimeZ(event.startTime)} - ${formatTimeZ(event.endTime)}`;
  const airportsLabel = Array.isArray(event.airports) ? event.airports.join(", ") : String(event.airports ?? "-");

  const normalizedEventForSignup = {
    ...event,
    airports: Array.isArray(event.airports) ? event.airports[0] : event.airports,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Event Info Card */}
        <Card className="md:col-span-1 order-2 md:order-1 h-fit">
          <CardHeader className="relative">
            <CardTitle>Event Informationen</CardTitle>
            <div className="absolute right-4">
              <Badge variant={event.status==="PLANNING" ? "default" : "secondary"}>{event.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="font-semibold">Name:</span> {event.name}</p>
            <p><span className="font-semibold">Datum:</span> {dateLabel}</p>
            <p><span className="font-semibold">Zeit:</span> {timeLabel}</p>
            <p><span className="font-semibold">Airport:</span> {airportsLabel}</p>
            <p><span className="font-semibold">Remarks:</span> {event.description}</p>
            
            {event.status==="PLANNING" ? (
              <Button className="w-full" variant={"secondary"}>Not Open</Button>
            ) : event.status==="SIGNUP_OPEN" ? (
              loading ? (
                <Button className="w-full mt-2" disabled>Laden...</Button>
              ) : (
                <Button className="w-full mt-2" onClick={() => setSelectedEvent(normalizedEventForSignup)}>
                  {isSignedUp ? "Anmeldung bearbeiten" : "Jetzt anmelden"}
                </Button>
              )
            ) : event.status==="PLAN_UPLOADED" ? (
              <Button className="w-full">Besetzungsplan</Button>
            ) : event.status === "COMPLETED" ? (
              <Button className="w-full" variant={"secondary"} disabled>Event abgeschlossen</Button>
            ) : (
              <Button className="w-full">Closed</Button>
            )}
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



      {(event.status === "SIGNUP_OPEN" || event.status === "PLAN_UPLOADED") && (
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle>Zu besetzende Stationen</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={(sortedgrouped[0]?.[0] || "GND")} className="w-full">
              <TabsList className="flex flex-wrap gap-2 bg-muted/50 p-1 rounded-lg w-full">
                {sortedgrouped.map(([area, stations]) => (
                  <TabsTrigger
                    key={area}
                    value={area}
                    className="rounded-md px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition"
                  >
                    {area}
                    <span className="ml-2 text-xs text-muted-foreground">({(stations as string[]).length})</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {sortedgrouped.map(([area, stations]) => (
                <TabsContent key={area} value={area}>
                  <div className="flex flex-wrap gap-2">
                    {(stations as string[]).map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs px-2.5 py-1 rounded-md">
                        {s}
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
          <CardTitle>Angemeldete Teilnehmer</CardTitle>
        </CardHeader>
        <CardContent>
        <SignupsTable
        signups={signups as any}
        loading={signupsLoading}
        error={signupsError}
        columns={["cid", "name", "availability", "remarks"]}
        />
        </CardContent>

        {event.status==="PLAN_UPLOADED" && (
          <div className="absolute inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center z-10 flex-col gap-3">
            <h1>Besetzungsplan ist verfügbar!</h1>
            <Button size="lg">Zum Besetzungsplan</Button>
          </div>
        )}
        
      </Card>

      <AnimatePresence>
        {selectedEvent && (
          <SignupForm
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onChanged={() => { refetch(); loadSignups(); }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}