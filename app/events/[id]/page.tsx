"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { StationGroup, stationsConfig } from "@/data/station_configs"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type EventDetail = {
  id: string
  name: string
  description: string
  bannerUrl: string
  airports: string
  stations: string[]
  documents: {
    name: string
    url: string
  }[]
}


export default function EventDetailPage() {
  const { id } = useParams()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const participants = [
    {
        id: "1649341",
        name: "Yannik Schäffler",
        position: "APP"
    },
    {
        id: "1638274",
        name: "Alex Legler",
        position: "CTR"
    },
    {
        id: "1756341",
        name: "Maximilian Grafwallner",
        position: "APP"
    },
]
  console.log("EVENT", event)
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/events/${id}`)
      const data = await res.json()
      setEvent(data)
    }
    fetchData()
  }, [id])

  if (!event) return <p className="p-6 text-center">Loading...</p>

  // Stationen nach Gruppe sortieren
  const groups: StationGroup[] = ["GND", "TWR", "APP", "CTR"];
  const filteredStations = groups.map((group) => ({
    group,
    stations: stationsConfig.filter(
      (s) => s.group === group && (!s.airport || s.airport === event.airports)
    ),
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Banner */}
      <div className="w-full h-64 rounded-2xl overflow-hidden shadow">
        <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
      </div>

      {/* Titel + Beschreibung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{event.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{event.description}</p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="stations" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        {/* Stationen */}
        <TabsContent value="stations">
        <Accordion type="multiple" className="w-full">
                {filteredStations.map(({ group, stations }) =>
                  stations.length > 0 ? (
                    <AccordionItem key={group} value={group}>
                      <AccordionTrigger>{group}</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {stations.map((station) => (
                            <div key={station.callsign} className="flex items-center space-x-2">
                              <Label htmlFor={station.callsign}>{station.callsign}</Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ) : null
                )}
              </Accordion>
        </TabsContent>

        {/* Teilnehmer */}
        <TabsContent value="participants">
          <div className="grid gap-3">
            {participants.length > 0 ? (
              participants.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <Avatar>
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${p.name}`} />
                      <AvatarFallback>{p.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.position}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">No participants yet</p>
            )}
          </div>
        </TabsContent>

        {/* Dateien */}
        <TabsContent value="files">
          <div className="space-y-2">
            {event.documents.length > 0 ? (
              event.documents.map((f, i) => (
                <div key={i} className="flex items-center justify-between border p-2 rounded-lg">
                  <span>{f.name}</span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Open
                  </a>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No files uploaded</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
