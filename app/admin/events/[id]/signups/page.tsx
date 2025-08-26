"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Types (flexibel gehalten, da Backend-Struktur evtl. variiert)
type TimeRange = { start: string; end: string };

type Signup = {
  id: string | number;
  userCID?: string | number;
  user?: { cid?: string | number; name?: string };
  endorsement?: "DEL" | "GND" | "TWR" | "APP" | "CTR" | string;
  availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
  remarks?: string | null;
};

type EventDetails = {
  id: string | number;
  name: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  airports?: string[] | string | null;
  description?: string | null;
  status?: string;
  staffedStations?: string[];
};

const PRIORITY: Record<string, number> = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4 };

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

// Generiert 30-Minuten-Slots zwischen Start/Ende (UTC). Gibt Times im Format HH:MM zurück.
function generateHalfHourSlotsUTC(startIso?: string, endIso?: string): string[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  // Start runden auf 30-Min-Slot
  const t = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()));
  const minutes = t.getUTCMinutes();
  if (minutes % 30 !== 0) {
    const delta = 30 - (minutes % 30);
    t.setUTCMinutes(minutes + delta);
  }
  const result: string[] = [];
  while (t <= end) {
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    result.push(`${hh}:${mm}`);
    t.setUTCMinutes(t.getUTCMinutes() + 30);
  }
  // Der letzte Slot ist Startzeit; für Zellen (Start inkl., Ende exkl.) ist die Länge result.length - 1 sinnvoll
  // Wir lassen alle drin und behandeln End-Exklusiv in der Anzeige.
  return result;
}

function isSlotUnavailable(slotHHMM: string, unavailable?: TimeRange[]): boolean {
  if (!unavailable || unavailable.length === 0) return false;
  const sm = toMinutesHM(slotHHMM);
  return unavailable.some((r) => {
    const s = toMinutesHM(r.start);
    const e = toMinutesHM(r.end);
    // Slot deckt Intervall [slot, slot+30); wir testen auf Überschneidung mit [s, e)
    const slotEnd = sm + 30;
    return Math.max(sm, s) < Math.min(slotEnd, e);
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
    default:
      return "bg-gray-100 text-gray-800";
  }
}

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

  const groupedSignups = useMemo(() => {
    const groups: Record<string, Signup[]> = {};
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

  const stats = useMemo(() => {
    const out: Record<string, number> = { DEL: 0, GND: 0, TWR: 0, APP: 0, CTR: 0 };
    for (const s of signups) {
      const k = (s.endorsement || "UNSPEC") as string;
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">DEL</p>
              <p className="text-xl font-semibold">{stats.DEL}</p>
            </div>
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
          {signupsLoading && <div className="text-sm text-muted-foreground mb-3">Lade Anmeldungen...</div>}
          {signupsError && <div className="text-sm text-red-500 mb-3">{signupsError}</div>}
          {signups.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Anmeldungen vorhanden.</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                {/* Header Row */}
                <div className="grid items-center" style={{ gridTemplateColumns: `240px repeat(${Math.max(slots.length - 1, 0)}, minmax(28px, 1fr))` }}>
                  <div className="text-xs text-muted-foreground px-2">Controller</div>
                  {slots.slice(0, -1).map((t) => (
                    <div key={t} className="h-8 flex items-center justify-center text-[10px] text-muted-foreground">
                      {t}z
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
                        <div key={String(s.id)} className="grid items-center" style={{ gridTemplateColumns: `240px repeat(${Math.max(slots.length - 1, 0)}, minmax(28px, 1fr))` }}>
                          <div className="flex items-center gap-2 px-2 py-1 border-r">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium leading-tight">{name || "Unbekannt"}</span>
                              <span className="text-xs text-muted-foreground leading-tight">CID {cid}</span>
                            </div>
                            <Badge className={badgeClassFor(s.endorsement)}>{s.endorsement || "UNSPEC"}</Badge>
                          </div>
                          {slots.slice(0, -1).map((st) => {
                            const unavailableSlot = isSlotUnavailable(st, unavailable);
                            const cls = hasAvailability
                              ? (unavailableSlot ? "bg-red-500" : "bg-emerald-400")
                              : "bg-gray-200";
                            return <div key={`${s.id}__${st}`} className={`h-6 border ${unavailableSlot ? "border-red-600" : "border-white"} ${cls}`} />;
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabelle: Rohdaten */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle>Alle Anmeldungen</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Endorsement</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>RMK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signupsLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>Laden...</TableCell>
                </TableRow>
              ) : signupsError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-red-500">{signupsError}</TableCell>
                </TableRow>
              ) : signups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">Keine Anmeldungen</TableCell>
                </TableRow>
              ) : (
                orderedAreas.flatMap((area) => [
                  <TableRow key={`group-${area}`}>
                    <TableCell colSpan={5} className="bg-muted/50 font-semibold">{area}</TableCell>
                  </TableRow>,
                  ...(groupedSignups[area] || []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.user?.cid ?? s.userCID}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {s.user?.name ?? ""}
                        <Badge className={badgeClassFor(s.endorsement)}>{s.endorsement || "UNSPEC"}</Badge>
                      </TableCell>
                      <TableCell>{s.endorsement || "-"}</TableCell>
                      <TableCell>
                        {s.availability?.unavailable && s.availability.unavailable.length === 0
                          ? "full"
                          : (s.availability?.available || [])
                              .map((r: TimeRange) => `${r.start}z-${r.end}z`)
                              .join(", ") || "-"}
                      </TableCell>
                      <TableCell>{s.remarks ?? "-"}</TableCell>
                    </TableRow>
                  )),
                ])
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
