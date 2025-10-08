"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SignupsTable from "@/components/SignupsTable";
import SyncToSheetsButton from "@/app/admin/_components/SyncToSheetsButton";

// Types
type TimeRange = { start: string; end: string };

type Signup = {
  id: string | number;
  userCID?: string | number;
  user?: { cid?: string | number; name?: string; rating?: string };
  endorsement?: "DEL" | "GND" | "TWR" | "APP" | "CTR" | string;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  remarks?: string | null;
};

type EventDetails = {
  id: string | number;
  name: string;
  startTime: string;
  endTime: string;
  airports?: string[] | string | null;
  description?: string | null;
  status?: string;
  staffedStations?: string[];
};

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

// Helper functions
function toMinutesHM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTimeZ(dateIso?: string | Date) {
  if (!dateIso) return "-";
  const d = new Date(dateIso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
}

function airportsLabel(airports?: string[] | string | null) {
  if (Array.isArray(airports)) return airports.join(", ");
  if (typeof airports === "string") return airports;
  return "-";
}

function generateHalfHourSlotsUTC(startIso?: string, endIso?: string): { slotStart: string; slotEnd: string }[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  const t = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()));
  
  // Auf nächste 30-Minuten-Intervall runden
  const minutes = t.getUTCMinutes();
  if (minutes % 30 !== 0) {
    const delta = 30 - (minutes % 30);
    t.setUTCMinutes(minutes + delta);
  }
  
  const result: { slotStart: string; slotEnd: string }[] = [];
  while (t < end) {
    const slotStart = new Date(t);
    t.setUTCMinutes(t.getUTCMinutes() + 30);
    const slotEnd = new Date(t);
    
    // Nur Slots hinzufügen, die nicht über das Event-Ende hinausgehen
    if (slotEnd <= end) {
      const startHH = String(slotStart.getUTCHours()).padStart(2, "0");
      const startMM = String(slotStart.getUTCMinutes()).padStart(2, "0");
      const endHH = String(slotEnd.getUTCHours()).padStart(2, "0");
      const endMM = String(slotEnd.getUTCMinutes()).padStart(2, "0");
      
      result.push({
        slotStart: `${startHH}:${startMM}`,
        slotEnd: `${endHH}:${endMM}`
      });
    }
  }
  return result;
}

function isSlotUnavailable(slotStart: string, slotEnd: string, unavailable?: TimeRange[]): boolean {
  if (!unavailable || unavailable.length === 0) return false;
  const slotStartMin = toMinutesHM(slotStart);
  const slotEndMin = toMinutesHM(slotEnd);
  
  return unavailable.some((r) => {
    const rangeStart = toMinutesHM(r.start);
    const rangeEnd = toMinutesHM(r.end);
    
    // Überlappung prüfen
    return Math.max(slotStartMin, rangeStart) < Math.min(slotEndMin, rangeEnd);
  });
}

function badgeClassFor(endorsement?: string) {
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
    case "S1":
      return "bg-blue-100 text-blue-800";
    case "S2":
      return "bg-amber-100 text-amber-800";
    case "S3":
      return "bg-purple-100 text-purple-800";
    case "C1":
      return "bg-red-100 text-red-800";
    case "C2":
      return "bg-red-100 text-red-800";
    case "C3":
      return "bg-red-100 text-red-800";
    case "I1":
      return "bg-red-100 text-red-800";
    case "I2":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Updated Availability Timeline Component
interface AvailabilityTimelineProps {
  signups: Signup[];
  slots: { slotStart: string; slotEnd: string }[];
  loading: boolean;
  error: string;
}

function AvailabilityTimeline({ signups, slots, loading, error }: AvailabilityTimelineProps) {
  const groupedSignups = useMemo(() => {
    const groups: Record<string, Signup[]> = {};
    for (const s of signups) {
      const key = (s.endorsement || s.user?.rating || "UNSPEC") as string;
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

  const timelineMinWidth = useMemo(() => {
    const NAME_COL_PX = 240;
    const SLOT_MIN_PX = 60; // Etwas breiter für die Zeit-Labels
    const slotCount = Math.max(slots.length, 0);
    return NAME_COL_PX + slotCount * SLOT_MIN_PX;
  }, [slots.length]);

  if (loading) return <div className="text-sm text-muted-foreground mb-3">Lade Anmeldungen...</div>;
  if (error) return <div className="text-sm text-red-500 mb-3">{error}</div>;
  if (signups.length === 0) return <div className="text-sm text-muted-foreground">Keine Anmeldungen vorhanden.</div>;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: timelineMinWidth }}>
        {/* Header Row mit Zeitskala zwischen den Blöcken */}
        <div className="grid items-center mb-2" style={{ 
          gridTemplateColumns: `240px repeat(${Math.max(slots.length, 0)}, minmax(60px, 1fr))` 
        }}>
          <div className="text-xs text-muted-foreground px-2">Controller</div>
          {slots.map((slot, index) => (
            <div 
              key={`header-${slot.slotStart}-${slot.slotEnd}`} 
              className="flex flex-col items-center justify-center text-[10px] text-muted-foreground border-l border-gray-300 first:border-l-0"
            >
              <div className="font-medium">{slot.slotStart}z</div>
              <div className="text-[8px] opacity-70 mt-0.5">bis</div>
              <div className="font-medium">{slot.slotEnd}z</div>
            </div>
          ))}
        </div>

        {/* Rows grouped by endorsement */}
        {orderedAreas.map((area) => (
          <div key={`grp-${area}`} className="mt-2">
            <div className="bg-muted/50 text-xs font-semibold px-2 py-1 rounded mb-1 inline-block">{area}</div>
            {groupedSignups[area]?.map((s) => {
              const name = s.user?.name || "";
              const cid = String(s.user?.cid ?? s.userCID ?? "");
              const unavailable = s.availability?.unavailable || [];
              const hasAvailability = (s.availability && ((s.availability.unavailable && s.availability.unavailable.length > 0) || (s.availability.available && s.availability.available.length > 0)));
              
              return (
                <div 
                  key={String(s.id)} 
                  className="grid items-center mb-1" 
                  style={{ 
                    gridTemplateColumns: `240px repeat(${Math.max(slots.length, 0)}, minmax(60px, 1fr))` 
                  }}
                >
                  {/* Controller Info */}
                  <div className="flex items-center gap-2 px-2 py-1 border-r bg-white/50">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium leading-tight truncate">{name || "Unbekannt"}</span>
                      <span className="text-xs text-muted-foreground leading-tight">CID {cid}</span>
                    </div>
                    <Badge className={`${badgeClassFor(s.endorsement || s.user?.rating)} shrink-0`}>
                      {s.endorsement || s.user?.rating || "UNSPEC"}
                    </Badge>
                  </div>

                  {/* Availability Slots */}
                  {slots.map((slot, slotIndex) => {
                    const unavailableSlot = isSlotUnavailable(slot.slotStart, slot.slotEnd, unavailable);
                    const cls = hasAvailability
                      ? (unavailableSlot ? "bg-red-500" : "bg-emerald-400")
                      : "bg-gray-200";
                    
                    return (
                      <div 
                        key={`${s.id}__${slot.slotStart}-${slot.slotEnd}`}
                        className={`h-8 border border-white relative group ${cls}`}
                      >
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Component
export default function AdminEventSignupsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventDetails | null>(null);
  const [eventLoading, setEventLoading] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string>("");

  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState<boolean>(false);
  const [signupsError, setSignupsError] = useState<string>("");

  useEffect(() => {
    if (!eventId) return;
    setEventLoading(true);
    setEventError("");

    fetch(`/api/events/${eventId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Fehler beim Laden des Events");
        }
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => setEventError(err.message || "Fehler beim Laden des Events"))
      .finally(() => setEventLoading(false));
  }, [eventId]);

  const loadSignups = () => {
    if (!eventId) return;
    setSignupsLoading(true);
    setSignupsError("");

    fetch(`/api/events/${eventId}/signup`)
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden der Anmeldungen");
        return res.json();
      })
      .then((data) => setSignups(data))
      .catch((err) => setSignupsError("Fehler beim Laden der Anmeldungen"))
      .finally(() => setSignupsLoading(false));
  };

  useEffect(() => {
    loadSignups();
  }, [eventId]);

  const stats = useMemo(() => {
    const out: Record<string, number> = { DEL: 0, GND: 0, TWR: 0, APP: 0, CTR: 0 };
    for (const s of signups) {
      const k = (s.endorsement || s.user?.rating || "UNSPEC") as string;
      if (out[k as keyof typeof out] !== undefined) out[k as keyof typeof out]! += 1;
    }
    return out;
  }, [signups]);

  const slots = useMemo(() => generateHalfHourSlotsUTC(event?.startTime, event?.endTime), [event?.startTime, event?.endTime]);

  if (eventLoading) return <div className="flex justify-center items-center h-64 text-muted-foreground">Lade Event...</div>;
  if (eventError || !event) return <div className="p-6 text-center text-red-500">{eventError || "Event nicht gefunden"}</div>;

  const dateLabel = new Date(event.startTime).toLocaleDateString("de-DE");
  const timeLabel = `${formatTimeZ(event.startTime)} - ${formatTimeZ(event.endTime)}`;

  return (
    <div className="p-6 space-y-6">
      {/* Event Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Anmeldungen: {event.name}</h1>
          <div className="text-muted-foreground">{dateLabel} • {timeLabel} • {airportsLabel(event.airports)}</div>
        </div>
        <div className="flex gap-2">
          <Badge variant={event.status === "SIGNUP_OPEN" ? "default" : "secondary"}>{event.status || "-"}</Badge>
          <Button variant="outline" onClick={loadSignups} disabled={signupsLoading}>Neu laden</Button>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Controller Statistik</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">GND</p>
              <p className="text-xl font-semibold">{stats.GND}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">TWR</p>
              <p className="text-xl font-semibold">{stats.TWR}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">APP</p>
              <p className="text-xl font-semibold">{stats.APP}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CTR</p>
              <p className="text-xl font-semibold">{stats.CTR}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Timeline */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle>Availability Übersicht (alle Zeiten UTC)</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityTimeline 
            signups={signups} 
            slots={slots} 
            loading={signupsLoading} 
            error={signupsError} 
          />
        </CardContent>
      </Card>

      {/* Tabelle: Rohdaten */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle>Alle Anmeldungen</CardTitle>
        </CardHeader>
        <CardContent>
          <SignupsTable
            signups={signups as Signup[]}
            loading={signupsLoading}
            error={signupsError}
            columns={["cid", "name", "availability", "preferredStations", "remarks"]}
            editable={true}
            event={event ? { id: event.id, startTime: event.startTime, endTime: event.endTime } : undefined}
            onRefresh={loadSignups}
          />
        </CardContent>
      </Card>
      <SyncToSheetsButton eventId={parseInt(event.id.toString())} />
    </div>
  );
}