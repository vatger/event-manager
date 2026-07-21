"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, User } from "lucide-react";

// Layout
const LABEL_W = 150;
const ROW_H = 40;
const PX_PER_HOUR = 96;

interface PublicRosterStation {
  id: number;
  callsign: string;
  sortOrder: number;
}

interface PublicRosterAssignment {
  id: number;
  stationId: number;
  type: "controller" | "custom";
  userCID: number | null;
  label: string | null;
  name: string;
  startTime: string;
  endTime: string;
}

interface PublicRosterData {
  slotMinutes: number;
  startTime: string;
  endTime: string;
  stations: PublicRosterStation[];
  assignments: PublicRosterAssignment[];
}

interface PublicRosterProps {
  eventId: number;
  /** CID des eingeloggten Nutzers (für Hervorhebung eigener Schichten) */
  userCID: number | null;
  /** Meldet dem Parent, ob ein interner Besetzungsplan existiert */
  onLoaded?: (hasRoster: boolean) => void;
}

function hm(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Öffentliche Ansicht des Besetzungsplans für Teilnehmer.
 * Eigene Schichten werden hervorgehoben und oben zusammengefasst.
 */
export default function PublicRoster({ eventId, userCID, onLoaded }: PublicRosterProps) {
  const [roster, setRoster] = useState<PublicRosterData | null>(null);
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/roster/public`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (cancelled) return;
        setRoster(data.roster);
        setPublished(Boolean(data.published));
        onLoaded?.(Boolean(data.roster));
      } catch {
        if (!cancelled) onLoaded?.(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onLoaded bewusst nicht in den Deps (Parent-Callback, nur einmal laden)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const eventStart = useMemo(
    () => (roster ? new Date(roster.startTime) : null),
    [roster]
  );
  const totalMinutes = useMemo(() => {
    if (!roster || !eventStart) return 0;
    return Math.max(
      0,
      Math.round((new Date(roster.endTime).getTime() - eventStart.getTime()) / 60000)
    );
  }, [roster, eventStart]);

  const pxPerMinute = PX_PER_HOUR / 60;
  const timelineWidth = totalMinutes * pxPerMinute;

  const toMin = (iso: string) =>
    eventStart ? Math.round((new Date(iso).getTime() - eventStart.getTime()) / 60000) : 0;

  const ownAssignments = useMemo(() => {
    if (!roster || !userCID) return [];
    return roster.assignments
      .filter((a) => a.userCID === userCID)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [roster, userCID]);

  const hourMarks = useMemo(() => {
    if (!eventStart) return [];
    const marks: { minute: number; label: string }[] = [];
    const first = new Date(eventStart);
    first.setUTCMinutes(0, 0, 0);
    let m = Math.round((first.getTime() - eventStart.getTime()) / 60000);
    if (m < 0) m += 60;
    for (; m <= totalMinutes; m += 60) {
      marks.push({ minute: m, label: hm(new Date(eventStart.getTime() + m * 60000)) });
    }
    return marks;
  }, [eventStart, totalMinutes]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!roster || !eventStart) return null;

  const stationById = new Map(roster.stations.map((s) => [s.id, s]));

  return (
    <Card id="besetzungsplan" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Besetzungsplan
          </span>
          <span className="flex items-center gap-2">
            {!published && <Badge variant="secondary">Vorschau (unveröffentlicht)</Badge>}
            <Badge variant="outline" className="font-normal">
              Alle Zeiten UTC
            </Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eigene Schichten */}
        {ownAssignments.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <User className="h-4 w-4 text-primary" />
              Deine Schichten
            </p>
            <div className="flex flex-wrap gap-2">
              {ownAssignments.map((a) => (
                <Badge key={a.id} className="bg-primary text-primary-foreground py-1 px-2.5">
                  {stationById.get(a.stationId)?.callsign ?? "?"}{" "}
                  <span className="ml-1 font-normal opacity-90">
                    {hm(new Date(a.startTime))}z – {hm(new Date(a.endTime))}z
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ width: LABEL_W + timelineWidth, minWidth: "100%" }}>
              {/* Stunden-Header */}
              <div className="flex border-b bg-muted/40">
                <div
                  className="sticky left-0 z-20 bg-muted/40 border-r px-3 py-1.5 text-xs font-semibold text-muted-foreground shrink-0"
                  style={{ width: LABEL_W }}
                >
                  Station
                </div>
                <div className="relative" style={{ width: timelineWidth, height: 24 }}>
                  {hourMarks.map((mark) => (
                    <div
                      key={mark.minute}
                      className="absolute top-0 bottom-0 border-l border-muted-foreground/25 pl-1 text-[10px] text-muted-foreground flex items-center"
                      style={{ left: mark.minute * pxPerMinute }}
                    >
                      {mark.label}z
                    </div>
                  ))}
                </div>
              </div>

              {/* Stationszeilen */}
              {roster.stations.map((station) => {
                const list = roster.assignments.filter((a) => a.stationId === station.id);
                return (
                  <div key={station.id} className="flex border-b last:border-b-0">
                    <div
                      className="sticky left-0 z-20 bg-background border-r px-3 shrink-0 flex items-center"
                      style={{ width: LABEL_W, height: ROW_H }}
                    >
                      <span className="text-sm font-medium truncate">{station.callsign}</span>
                    </div>
                    <div
                      className="relative shrink-0"
                      style={{
                        width: timelineWidth,
                        height: ROW_H,
                        backgroundImage: `repeating-linear-gradient(to right, rgba(120,120,120,0.18) 0 1px, transparent 1px ${PX_PER_HOUR}px)`,
                      }}
                    >
                      {list.map((a) => {
                        const start = toMin(a.startTime);
                        const end = toMin(a.endTime);
                        const own = userCID !== null && a.userCID === userCID;
                        const isCustom = a.type === "custom";
                        return (
                          <div
                            key={a.id}
                            className={`absolute top-1 bottom-1 rounded-md border px-1.5 flex items-center overflow-hidden text-[11px] font-medium ${
                              own
                                ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 z-10"
                                : isCustom
                                ? "bg-muted/40 text-muted-foreground border-dashed"
                                : "bg-muted text-foreground border-border"
                            }`}
                            style={{
                              left: Math.max(0, start) * pxPerMinute,
                              width: Math.max((end - start) * pxPerMinute, 8),
                            }}
                            title={`${a.name} • ${hm(new Date(a.startTime))}z – ${hm(new Date(a.endTime))}z`}
                          >
                            <span className="truncate">
                              {own ? "Du" : a.name}
                              <span className="opacity-70 font-normal ml-1 hidden sm:inline">
                                {hm(new Date(a.startTime))}–{hm(new Date(a.endTime))}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
