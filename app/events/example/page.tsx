"use client"

import SignupForm from "@/components/SignupForm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from "@/components/ui/table"
import { AnimatePresence } from "framer-motion"
import { useState } from "react"

const eventData = {
  name: "Munich Overload",
  startTime: "2024-10-26",
  endTime: "16:00z - 21:00z",
  bannerUrl: "https://dms.vatsim-germany.org/apps/files_sharing/publicpreview/pacA32LoRwkckA6?file=/&fileId=190971&x=2560&y=1440&a=true&etag=2aec907d751ebe55c7f1bb35d62271fc",
  status: "SIGNUP_OPEN", // planning | signup_open | closed | roster_published
  airports: ["EDDM"],
  rosterUrl: "https://docs.google.com/spreadsheets/d/xxxx",
  briefingUrl: "https://yourcdn.com/briefing.pdf",
  staffedStations: {
    GND: ["EDDM_DEL", "EDDM_1_GND", "EDDM_2_GND"],
    TWR: ["EDDM_N_GND", "EDDM_S_GND", "EDDM_N_TWR", "EDDM_S_TWR"],
    APP: ["EDDM_NH_APP", "EDDM_SH_APP", "EDDM_NL_APP", "EDDM_SL_APP", "EDDM_ND_APP", "EDDM_SD_APP"],
    CTR: ["EDMM_ALB_CTR", "EDMM_ZUG_CTR", "EDMM_WLD_CTR", "EDUU_ALP_CTR"],
  },
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
export default function EventPage(){
    const { name, startTime, endTime, bannerUrl, status, airports, rosterUrl, briefingUrl, staffedStations, participants } =
        eventData

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
        <Card className="md:col-span-1 h-fit order-2 md:order-1">
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
            {status=="PLANNING" ? (
                <Button className="w-full" variant={"secondary"}>Not Open</Button>
            ) : status=="SIGNUP_OPEN" ? (
                <Button className="w-full mt-2" onClick={() => setSelectedEvent(eventData)}>Jetzt anmelden</Button>
            ) : (
                <Button className="w-full">Closed</Button>
            )}
            
          </CardContent>
        </Card>

        {/* Event Banner */}
        <div className="md:col-span-2 order-1 md:order-2">
          <div className="w-full h-64 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-500">
            <img src={bannerUrl} alt="Event Banner" className="rounded-2xl shadow-lg w-full h-full object-cover" />
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