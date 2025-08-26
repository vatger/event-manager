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

const eventData = {
  name: "Munich Overload",
  id: 5,
  description: "Here could be some Remarks of the Event. This is the Munich Overload. The whole Airport will be fully staffed from Delivery up to Center. Take your favourite aircraft and enjoy best bavarian ATC with a Flight from or to Munich.",
  startTime: "2024-10-26",
  endTime: "16:00z - 21:00z",
  bannerUrl: "https://dms.vatsim-germany.org/apps/files_sharing/publicpreview/pacA32LoRwkckA6?file=/&fileId=190971&x=2560&y=1440&a=true&etag=2aec907d751ebe55c7f1bb35d62271fc",
  status: "SIGNUP_OPEN", // planning | signup_open | closed | ROSTER
  airports: ["EDDM"],
  rosterUrl: "https://docs.google.com/spreadsheets/d/xxxx",
  briefingUrl: "https://yourcdn.com/briefing.pdf",
  staffedStations: [
    "EDDM_DEL", "EDDM_C_DEL", "EDDM_1_GND", "EDDM_2_GND", "EDDM_N_GND", "EDDM_S_GND",
    "EDDM_N_TWR", "EDDM_S_TWR", "EDDM_NH_APP", "EDDM_SH_APP", "EDDM_NL_APP", "EDDM_SL_APP", "EDDM_ND_APP", "EDDM_SD_APP", "EDMM_WLD_CTR", "EDMM_STA_CTR", "EDUU_APL_CTR", "EDUU_CHI_CTR", "EDMM_ALB_CTR"
  ],
  participants: [
    { name: "Yannik Schäffler", cid: "1234567", position: "EDDM_NL_APP" },
    { name: "Max Grafwallner", cid: "2345678", position: "EDDM_NH_APP" },
    { name: "Niklas Schellhorn", cid: "2315678", position: "EDDM_S_TWR" },
    { name: "Florian Meiler", cid: "2335678", position: "EDDM_N_GND" },
    { name: "Justin Korte", cid: "2345778", position: "EDDM_DEL" },
    { name: "Alex Legler", cid: "2345608", position: "EDMM_ZUG_CTR" },
    { name: "Leander Greiff", cid: "2395678", position: "EDMM_WLD_CTR" }
  ],
}

// Hilfsfunktion: nach den letzten 3 Buchstaben gruppieren
function groupBySuffix(stations: string[]) {
  return stations.reduce((acc: Record<string, string[]>, station) => {
    const suffix = station.slice(-3) // z. B. "GND", "DEL", "TWR", "APP", "CTR"
    if (!acc[suffix]) acc[suffix] = []
    acc[suffix].push(station)
    return acc
  }, {})
}

export default function EventPage(){
    const {data: session} = useSession()

    const userCID = session?.user.id;
    const { name, startTime, endTime, description, bannerUrl, status, airports, rosterUrl, briefingUrl, staffedStations } =
        eventData

    const grouped = groupBySuffix(staffedStations)
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [signups, setSignups] = useState<any[]>([]);
    const [signupsLoading, setSignupsLoading] = useState<boolean>(false);
    const [signupsError, setSignupsError] = useState<string>("");

    const loadSignups = () => {
      setSignupsLoading(true);
      fetch(`/api/events/${eventData.id}/signup`)
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
    }, []);

    const areaOrder = ["GND", "DEL", "TWR", "APP", "CTR"]; // GND oben, CTR unten

    const badgeClassFor = (endorsement?: string) => {
      switch (endorsement) {
        case "GND":
          return "bg-green-100 text-green-800";
        case "DEL":
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
      const idx = (v: string) => {
        const i = areaOrder.indexOf(v);
        return i === -1 ? 999 : i;
      };
      return present.sort((a, b) => idx(a) - idx(b));
    }, [groupedSignups]);

    const formatAvailability = (availability?: any) => {
      if(availability?.unavailable.length == 0) return "full"
      const ranges = availability?.available as { start: string; end: string }[] | undefined;
      if (!ranges || ranges.length === 0) return "-";
      return ranges.map((r) => `${r.start}z-${r.end}z`).join(", ");
    };

    const { loading, isSignedUp, signupData, refetch } = useEventSignup(eventData.id, Number(userCID));

    return (
        // <div className="max-w-5xl mx-auto space-y-6 p-4">
        //     {/* Banner */}
        //     <img src={bannerUrl} alt="Event Banner" className="rounded-2xl shadow-lg w-full" />

        //     {/* Event Header */}
        //     <div className="text-center space-y-2">
        //         <h1 className="text-3xl font-bold">{name}</h1>
        //         <p className="text-gray-600">{startTime} | {endTime}</p>
        //     </div>
        // </div>
        <div className="p-6 space-y-6">
      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Event Info Card */}
        <Card className="md:col-span-1 order-2 md:order-1 h-fit">
          <CardHeader className="relative">
            <CardTitle>Event Informationen</CardTitle>
            <div className="absolute right-4">
              <Badge variant={status=="PLANNING" ? "default" : "secondary"}>{status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="font-semibold">Name:</span> {name}</p>
            <p><span className="font-semibold">Datum:</span> {startTime}</p>
            <p><span className="font-semibold">Zeit:</span> {endTime}</p>
            <p><span className="font-semibold">Airport:</span> {airports}</p>
            <p><span className="font-semibold">Remarks:</span> {description}</p>
            
            {status==="PLANNING" ? (
              <Button className="w-full" variant={"secondary"}>Not Open</Button>
            ) : status==="SIGNUP_OPEN" ? (
              loading ? (
                <Button className="w-full mt-2" disabled>Laden...</Button>
              ) : (
                <Button className="w-full mt-2" onClick={() => setSelectedEvent(eventData)}>
                  {isSignedUp ? "Anmeldung bearbeiten" : "Jetzt anmelden"}
                </Button>
              )
            ) : status==="ROSTER" ? (
              <Button className="w-full">Besetzungsplan</Button>
            ) : (status === "SIGNUP_CLOSED" || status === "closed") ? (
              <Button className="w-full" variant={"secondary"} disabled>Anmeldung geschlossen</Button>
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
              src={bannerUrl}
              alt="Event Banner"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          </div>
        </div>
        </div>



      {(status === "SIGNUP_OPEN" || status === "SIGNUP_CLOSED") && (
        <Card className="relative overflow-hidden">
          <CardHeader>
            <CardTitle>Zu besetzende Stationen</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={(Object.keys(grouped)[0] || "GND")} className="w-full">
              <TabsList className="flex flex-wrap gap-2 bg-muted/50 p-1 rounded-lg w-full">
                {Object.entries(grouped).map(([area, stations]) => (
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
              {Object.entries(grouped).map(([area, stations]) => (
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

        {status=="ROSTER" && (
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