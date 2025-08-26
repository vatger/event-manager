"use client"

import SignupForm from "@/components/SignupForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEventSignup } from "@/hooks/useEventSignup"
import { AnimatePresence } from "framer-motion"
import { useSession } from "next-auth/react"
import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"


const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

// Hilfsfunktion: nach den letzten 3 Buchstaben gruppieren
function groupBySuffix(stations: string[]) {
  return stations.reduce((acc: Record<string, string[]>, station) => {
    const suffix = station.slice(-3) // z. B. "GND", "DEL", "TWR", "APP", "CTR"
    if (!acc[suffix]) acc[suffix] = []
    acc[suffix].push(station)
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

  
  const badgeClassFor = (endorsement?: string) => {
    switch (endorsement) {
      case "DEL":
        return "bg-green-100 text-green-800";
      case "GND":
        return "bg-blue-100 text-blue-800";
      case "TWR":
        return "bg-amber-100 text-amber-800";
      case "APP":
        return "bg-purple-100 text-purple-800";
      case "CTR":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const groupedSignups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const s of signups) {
      const key = (s.endorsement || "UNSPEC") as string;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [signups]);

  const orderedAreas = useMemo(() => {
    const present = Object.keys(groupedSignups);
    const idx = (v: string) => PRIORITY[v] ?? 999;
    return present.sort((a, b) => idx(a) - idx(b));
  }, [groupedSignups]);

  const formatAvailability = (availability?: any) => {
    if(availability?.unavailable?.length === 0) return "full";
    const ranges = availability?.available as { start: string; end: string }[] | undefined;
    if (!ranges || ranges.length === 0) return "-";
    return ranges.map((r) => `${r.start}z-${r.end}z`).join(", ");
  };

  const eventId = event?.id ?? id;
  const { loading, isSignedUp, signupData, refetch } = useEventSignup(eventId, Number(userCID));

  if (eventLoading) return <p className="p-6 text-center">Laden...</p>;
  if (eventError) return <p className="p-6 text-center text-red-500">{eventError}</p>;
  if (!event) return <p className="p-6 text-center">Event nicht gefunden</p>;

  const grouped = groupBySuffix(event?.staffedStations || []);
  const sortedgrouped = Object.entries(grouped).sort( ([a], [b]) => (PRIORITY[a] ?? Number.POSITIVE_INFINITY) - (PRIORITY[b] ?? Number.POSITIVE_INFINITY) )
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
            <Tabs defaultValue={(sortedgrouped[0]?.[0] || "DEL")} className="w-full">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>RMK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {signupsLoading ? (
              <TableRow>
                <TableCell colSpan={4}>Laden...</TableCell>
              </TableRow>
            ) : signupsError ? (
              <TableRow>
                <TableCell colSpan={4} className="text-red-500">{signupsError}</TableCell>
              </TableRow>
            ) : signups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>Keine Anmeldungen</TableCell>
              </TableRow>
            ) : (
              orderedAreas.flatMap((area) => [
                <TableRow key={`group-${area}`}>
                  <TableCell colSpan={4} className="bg-muted/50 font-semibold">{area}</TableCell>
                </TableRow>,
                ...(groupedSignups[area] || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.user?.cid ?? s.userCID}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {s.user?.name ?? ""}
                      <Badge className={badgeClassFor(s.endorsement)}>{s.endorsement || "UNSPEC"}</Badge>
                    </TableCell>
                    <TableCell>{formatAvailability(s.availability)}</TableCell>
                    <TableCell>{s.remarks ?? "-"}</TableCell>
                  </TableRow>
                )),
              ])
            )}
            </TableBody>
          </Table>
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