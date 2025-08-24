"use client"

import SignupForm from "@/components/SignupForm"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { AnimatePresence } from "framer-motion"
import { useState } from "react"

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
    "EDDM_N_TWR", "EDDM_S_TWR", "EDDM_NH_APP", "EDDM_SH_APP", "EDDM_NL_APP", "EDDM_SL_APP", "EDDM_NL_APP", "EDDM_SD_APP", "EDMM_WLD_CTR", "EDMM_STA_CTR", "EDUU_APL_CTR", "EDUU_CHI_CTR", "EDMM_ALB_CTR"
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
    
    const { name, startTime, endTime, description, bannerUrl, status, airports, rosterUrl, briefingUrl, staffedStations, participants } =
        eventData

    const grouped = groupBySuffix(staffedStations)
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null); 
    
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
            {status=="SIGNUP_OPEN" || status=="closed" && (
              <div>
                <p><span className="font-semibold">Zu besetzende Stationen:</span></p>
                <Accordion type="single" collapsible className="w-full">
                  {Object.entries(grouped).map(([area, stations]) => (
                    <AccordionItem key={area} value={area}>
                      <AccordionTrigger>{area}</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-6 space-y-1">
                          {stations.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {status=="PLANNING" ? (
              <Button className="w-full" variant={"secondary"}>Not Open</Button>
            ) : status=="SIGNUP_OPEN" ? (
              <Button className="w-full mt-2" onClick={() => setSelectedEvent(eventData)}>Jetzt anmelden</Button>
            ) : status=="ROSTER" ? (
              <Button className="w-full">Besetzungsplan</Button>
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
                <TableHead>Station</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {participants.map((p) => (
              <TableRow key={p.cid}>
                <TableCell>{p.cid}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.position}</TableCell>
              </TableRow>
            ))}
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
          />
        )}
      </AnimatePresence>
    </div>
  )
}