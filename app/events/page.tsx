
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const eventData = {
  title: "Munich Overload 2025",
  date: "2025-10-18",
  time: "17:00z - 22:00z",
  bannerUrl: "https://dms.vatsim-germany.org/apps/files_sharing/publicpreview/pacA32LoRwkckA6?file=/&fileId=190971&x=2560&y=1440&a=true&etag=2aec907d751ebe55c7f1bb35d62271fc",
  status: "roster_published", // planning | signup_open | closed | roster_published
  rosterUrl: "https://docs.google.com/spreadsheets/d/xxxx",
  briefingUrl: "https://yourcdn.com/briefing.pdf",
  stations: {
    GND: ["EDDM_DEL", "EDDM_1_GND", "EDDM_2_GND"],
    TWR: ["EDDM_N_GND", "EDDM_S_GND", "EDDM_N_TWR", "EDDM_S_TWR"],
    APP: ["EDDM_NH_APP", "EDDM_SH_APP", "EDDM_NL_APP", "EDDM_SL_APP", "EDDM_ND_APP", "EDDM_SD_APP"],
    CTR: ["EDMM_ALB_CTR", "EDMM_ZUG_CTR", "EDMM_WLD_CTR", "EDUU_ALP_CTR"],
  },
  participants: [
    { name: "Yannik Schäffler", cid: "1234567", position: "EDDM_NL_APP" },
    { name: "Max Grafwallner", cid: "2345678", position: "EDDM_NH_APP" },
    { name: "Niklas Schellhorn", cid: "2345678", position: "EDDM_S_TWR" },
    { name: "Florian Meiler", cid: "2345678", position: "EDDM_N_GND" },
    { name: "Justin Korte", cid: "2345678", position: "EDDM_DEL" },
    { name: "Alex Legler", cid: "2345678", position: "EDMM_ZUG_CTR" },
    { name: "Leander Greiff", cid: "2345678", position: "EDMM_WLD_CTR" }
  ],
}

export default function EventPage() {
  const { title, date, time, bannerUrl, status, rosterUrl, briefingUrl, stations, participants } =
    eventData

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Banner */}
      <img src={bannerUrl} alt="Event Banner" className="rounded-2xl shadow-lg w-full" />

      {/* Event Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-gray-600">{date} | {time}</p>
      </div>

      {/* Event Actions */}
      <div className="flex gap-4 justify-center">
        {status === "signup_open" && <Button>Anmelden</Button>}
        {status === "roster_published" && (
          <Button asChild>
            <a href={rosterUrl} target="_blank" rel="noopener noreferrer">
              Zum Roster
            </a>
          </Button>
        )}
        {briefingUrl && status !== "planning" && (
          <Button variant="outline" asChild>
            <a href={briefingUrl} target="_blank" rel="noopener noreferrer">
              Controller Briefing
            </a>
          </Button>
        )}
      </div>

      {/* Stations (Tabs nach Gruppe) */}
      <Card>
        <CardHeader>
          <CardTitle>Zu besetzende Stationen</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="GND">
            <TabsList className="grid grid-cols-4 w-full">
              {Object.keys(stations).map((group) => (
                <TabsTrigger key={group} value={group}>
                  {group}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(stations).map(([group, pos]) => (
              <TabsContent key={group} value={group} className="grid grid-cols-2 gap-3">
                {pos.map((p) => {
                  const assigned = participants.find((pt) => pt.position === p)
                  return (
                    <Card key={p} className="p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-mono">{p}</span>
                        {assigned ? (
                          <span className="text-gray-400 font-semibold">121.710</span>
                        ) : (
                          <span className="text-gray-400 italic">118.705</span>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Teilnehmerliste */}
      {status !== "planning" && (
        <Card>
          <CardHeader>
            <CardTitle>Angemeldete Teilnehmer</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {participants.map((p) => (
                <li key={p.cid} className="flex justify-between border-b py-1">
                  <span>{p.name}</span>
                  <span className="text-sm text-gray-500">{p.position}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
