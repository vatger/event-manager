"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Crosshair, Radio, User, Users } from "lucide-react";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";
import { airportTintColors, stationBlockColors } from "@/lib/roster/stationColors";
import { cn } from "@/lib/utils";

// Layout
const LABEL_W = 152;
const ROW_H = 38;
const GROUP_H = 26;
const PX_PER_HOUR = 108;
/** Wie oft die Jetzt-Linie nachgeführt wird */
const TICK_MS = 30_000;
/** Unterhalb dieser Breite fallen Beschriftung und Stundenbreite kleiner aus */
const NARROW_PX = 768;

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

/** Zeilen der Timeline – je nach Ansicht Stationen oder Lotsen */
interface TimelineRow {
  key: string;
  title: string;
  subtitle?: string;
  /** Eigene Zeile (nur in der Lotsen-Ansicht) */
  own: boolean;
  blocks: PublicRosterAssignment[];
  /** Airport der Zeile – trennt die Stationsansicht in Gruppen */
  airport: string | null;
}

type ViewMode = "stations" | "controllers";

function hm(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

const airportOf = (callsign: string): string | null =>
  /^[A-Z]{4}/i.test(callsign) ? callsign.slice(0, 4).toUpperCase() : null;

/**
 * Öffentliche Ansicht des Besetzungsplans für Teilnehmer.
 *
 * Zwei Blickwinkel auf dieselben Daten: „Stationen" beantwortet „wer sitzt auf
 * EDDF_TWR?", „Lotsen" beantwortet „wann ist wer dran?". Eine mitlaufende
 * Jetzt-Linie zeigt während des Events den aktuellen Stand, eigene Schichten
 * sind durchgehend hervorgehoben.
 */
export default function PublicRoster({ eventId, userCID, onLoaded }: PublicRosterProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const [roster, setRoster] = useState<PublicRosterData | null>(null);
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("stations");
  const [now, setNow] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  // Auf schmalen Geräten fallen die Maße kleiner aus, damit vom Zeitstrahl
  // mehr als eine Stunde ins Bild passt.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_PX - 1}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Auf dem Telefon ist jeder Pixel Beschriftung einer weniger für den Plan.
  const labelW = narrow ? 104 : LABEL_W;
  const pxPerHour = narrow ? 84 : PX_PER_HOUR;

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

  // Jetzt-Linie nachführen. Der Takt ist bewusst grob – auf Stundenbreite
  // entspricht eine halbe Minute weniger als zwei Pixel.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(t);
  }, []);

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

  const pxPerMinute = pxPerHour / 60;
  const timelineWidth = totalMinutes * pxPerMinute;

  const toMin = useCallback(
    (iso: string) =>
      eventStart ? Math.round((new Date(iso).getTime() - eventStart.getTime()) / 60000) : 0,
    [eventStart]
  );

  /** Minute der aktuellen Zeit – null, wenn außerhalb des Events */
  const nowMinute = useMemo(() => {
    if (!eventStart) return null;
    const m = (now.getTime() - eventStart.getTime()) / 60000;
    if (m < 0 || m > totalMinutes) return null;
    return m;
  }, [now, eventStart, totalMinutes]);

  /** Läuft diese Schicht gerade? Ersetzt in der Liste die Jetzt-Linie. */
  const isRunning = useCallback(
    (a: PublicRosterAssignment) => {
      const t = now.getTime();
      return t >= new Date(a.startTime).getTime() && t < new Date(a.endTime).getTime();
    },
    [now]
  );

  const ownAssignments = useMemo(() => {
    if (!roster || !userCID) return [];
    return roster.assignments
      .filter((a) => a.userCID === userCID)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [roster, userCID]);

  /**
   * Airports in der Reihenfolge ihres Auftretens.
   *
   * Die Stationen kommen bereits in der im Editor festgelegten Reihenfolge, und
   * die Gruppen leiten sich aus ihr ab (erstes Auftreten) – genau wie im Editor.
   * Dieselbe Reihenfolge bestimmt auch die Farbvergabe, damit ein Airport hier
   * und dort gleich aussieht.
   */
  const rosterAirports = useMemo(() => {
    const list: string[] = [];
    for (const st of roster?.stations ?? []) {
      const ap = airportOf(st.callsign);
      if (ap && !list.includes(ap)) list.push(ap);
    }
    return list;
  }, [roster]);

  const multiAirport = rosterAirports.length > 1;

  const stationById = useMemo(
    () => new Map((roster?.stations ?? []).map((s) => [s.id, s])),
    [roster]
  );

  /** Farben einer Station – Ton nach Airport, Helligkeit nach Ebene */
  const toneFor = useCallback(
    (callsign: string) =>
      stationBlockColors(airportOf(callsign), extractStationGroup(callsign), rosterAirports),
    [rosterAirports]
  );

  /** Zeilen für die gewählte Ansicht */
  const rows: TimelineRow[] = useMemo(() => {
    if (!roster) return [];
    if (view === "stations") {
      const byStation = roster.stations.map((station) => ({
        key: `station-${station.id}`,
        title: station.callsign,
        own:
          userCID !== null &&
          roster.assignments.some((a) => a.stationId === station.id && a.userCID === userCID),
        blocks: roster.assignments.filter((a) => a.stationId === station.id),
        airport: airportOf(station.callsign),
      }));
      if (!multiAirport) return byStation;
      // Nach Airport bündeln, Gruppen in der Reihenfolge ihres ersten
      // Auftretens. Ohne diesen Schritt stünden verstreute Stationen eines
      // Platzes auseinander, sobald jemand im Editor einzeln umsortiert hat.
      return rosterAirports.flatMap((ap) => byStation.filter((r) => r.airport === ap));
    }

    // Lotsen-Ansicht: eine Zeile je Person. Custom-Blöcke (Combined, Training)
    // hängen an keiner Person und bleiben deshalb der Stationsansicht vorbehalten.
    const byCid = new Map<number, PublicRosterAssignment[]>();
    for (const a of roster.assignments) {
      if (a.userCID == null) continue;
      const list = byCid.get(a.userCID);
      if (list) list.push(a);
      else byCid.set(a.userCID, [a]);
    }
    return [...byCid.entries()]
      .map(([cid, list]) => {
        const minutes = list.reduce(
          (sum, a) => sum + (toMin(a.endTime) - toMin(a.startTime)),
          0
        );
        const own = userCID !== null && cid === userCID;
        const duration = `${Math.floor(minutes / 60)}h${
          minutes % 60 ? ` ${minutes % 60}min` : ""
        }`;
        return {
          key: `cid-${cid}`,
          title: list[0].name,
          // Der Name bleibt stehen; die eigene Zeile ist schon farblich
          // hervorgehoben, das „Du" gehört in die knappe Unterzeile.
          subtitle: own ? `Du • ${duration}` : duration,
          own,
          blocks: [...list].sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          ),
          airport: null,
        };
      })
      .sort((a, b) => {
        // Eigene Zeile immer oben, danach alphabetisch
        if (a.own !== b.own) return a.own ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
  }, [roster, view, userCID, toMin, multiAirport, rosterAirports]);

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

  /** Zeitstrahl auf die aktuelle Zeit schieben */
  const scrollToNow = useCallback(() => {
    const el = scrollRef.current;
    if (!el || nowMinute === null) return;
    el.scrollTo({
      left: Math.max(0, nowMinute * pxPerMinute - el.clientWidth / 2),
      behavior: "smooth",
    });
  }, [nowMinute, pxPerMinute]);

  // Läuft das Event gerade, startet die Ansicht direkt beim Jetzt
  useEffect(() => {
    if (didAutoScroll.current || nowMinute === null || !scrollRef.current) return;
    didAutoScroll.current = true;
    scrollToNow();
  }, [nowMinute, scrollToNow]);

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

  /** Zeitspanne einer Schicht, überall gleich geschrieben */
  const span = (a: PublicRosterAssignment) =>
    `${hm(new Date(a.startTime))}–${hm(new Date(a.endTime))}z`;

  /** Kopfzeile einer Airport-Gruppe im Zeitstrahl */
  const renderGroupHeader = (airport: string) => {
    const tint = airportTintColors(airport, rosterAirports, isDark);
    return (
      // Der Farbstreifen sitzt am äußeren Element, damit er auch den Bereich
      // rechts der Zeitachse füllt – sonst bräche die Gruppe mitten in der
      // Zeile ab, wenn das Fenster breiter ist als das Event lang.
      <div
        key={`group-${airport}`}
        className="flex border-b"
        style={{ backgroundColor: tint.background }}
      >
        <div
          className="sticky left-0 z-30 border-r px-3 flex items-center shrink-0"
          style={{ width: labelW, height: GROUP_H, backgroundColor: tint.background }}
        >
          <span className="text-[11px] font-semibold tracking-wide">{airport}</span>
        </div>
        <div className="flex-1" style={{ height: GROUP_H, minWidth: timelineWidth }} />
      </div>
    );
  };

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
          <div className="rounded-lg border border-accent-500/40 bg-accent-500/5 p-3">
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <User className="h-4 w-4 text-accent-500" />
              Deine Schichten
            </p>
            <div className="flex flex-wrap gap-2">
              {ownAssignments.map((a) => {
                const callsign = stationById.get(a.stationId)?.callsign ?? "?";
                const tone = toneFor(callsign);
                return (
                  <span
                    key={a.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                      isRunning(a) && "ring-2 ring-accent-500 ring-offset-1 ring-offset-background"
                    )}
                    style={{ backgroundColor: tone.background, color: tone.text }}
                  >
                    {callsign}
                    <span className="font-normal opacity-90">{span(a)}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Umschalter: Blickwinkel, Darstellung, Sprung zur aktuellen Zeit */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setView("stations")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "stations"
                  ? "bg-accent-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Radio className="h-3.5 w-3.5" />
              Stationen
            </button>
            <button
              type="button"
              onClick={() => setView("controllers")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === "controllers"
                  ? "bg-accent-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Lotsen
            </button>
          </div>

          {nowMinute !== null && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs ml-auto"
              onClick={scrollToNow}
            >
              <Crosshair className="h-3.5 w-3.5 mr-1.5" />
              Zur aktuellen Zeit
            </Button>
          )}
        </div>

        {/* Zeitstrahl */}
      <div className="border rounded-lg overflow-hidden">
          <div ref={scrollRef} className="overflow-x-auto">
            <div
              className="relative"
              style={{ width: labelW + timelineWidth, minWidth: "100%" }}
            >
              {/* Stunden-Header */}
              <div className="flex border-b bg-muted/40">
                <div
                  className="sticky left-0 z-30 bg-muted/40 border-r px-3 py-1.5 text-xs font-semibold text-muted-foreground shrink-0"
                  style={{ width: labelW }}
                >
                  {view === "stations" ? "Station" : "Lotse"}
                </div>
                <div className="relative shrink-0" style={{ width: timelineWidth, height: 24 }}>
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

              {rows.map((row, index) => {
                const groupStart =
                  view === "stations" &&
                  multiAirport &&
                  row.airport !== null &&
                  (index === 0 || rows[index - 1].airport !== row.airport);
                return (
                  <div key={row.key}>
                    {groupStart && renderGroupHeader(row.airport!)}
                    <div
                      className={cn(
                        "flex border-b",
                        row.own && view === "controllers" && "bg-accent-500/5"
                      )}
                    >
                      <div
                        className={cn(
                          "sticky left-0 z-30 border-r px-3 shrink-0 flex flex-col justify-center",
                          row.own && view === "controllers"
                            ? "bg-accent-500/10"
                            : "bg-background"
                        )}
                        style={{ width: labelW, height: ROW_H }}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium truncate leading-tight",
                            row.own && "text-accent-600 dark:text-accent-400"
                          )}
                        >
                          {row.title}
                        </span>
                        {row.subtitle && (
                          <span className="text-[10px] text-muted-foreground leading-tight">
                            {row.subtitle}
                          </span>
                        )}
                      </div>
                      <div
                        className="relative shrink-0"
                        style={{
                          width: timelineWidth,
                          height: ROW_H,
                          backgroundImage: `repeating-linear-gradient(to right, rgba(120,120,120,0.18) 0 1px, transparent 1px ${pxPerHour}px)`,
                        }}
                      >
                        {row.blocks.map((a) => {
                          const start = toMin(a.startTime);
                          const end = toMin(a.endTime);
                          const own = userCID !== null && a.userCID === userCID;
                          const callsign = stationById.get(a.stationId)?.callsign ?? "";
                          const tone = toneFor(callsign);
                          const label =
                            a.type === "custom"
                              ? a.label ?? "Sonstiges"
                              : view === "stations"
                              ? own
                                ? "Du"
                                : a.name
                              : callsign;
                          return (
                            <div
                              key={a.id}
                              className={cn(
                                "absolute top-1 bottom-1 rounded-md px-1.5 flex items-center overflow-hidden text-[11px] font-medium",
                                a.type === "custom" &&
                                  "bg-station-none/70 border border-dashed border-white/40 text-white",
                                own &&
                                  "ring-2 ring-offset-1 ring-accent-500 ring-offset-background z-10"
                              )}
                              style={{
                                left: Math.max(0, start) * pxPerMinute,
                                width: Math.max((end - start) * pxPerMinute, 8),
                                ...(a.type === "custom"
                                  ? {}
                                  : { backgroundColor: tone.background, color: tone.text }),
                              }}
                              title={`${callsign || a.label} • ${a.name} • ${span(a)}`}
                            >
                              <span className="truncate">
                                {label}
                                <span className="opacity-80 font-normal ml-1 hidden sm:inline">
                                  {hm(new Date(a.startTime))}–{hm(new Date(a.endTime))}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {rows.length === 0 && (
                <p className="px-3 py-6 text-sm text-muted-foreground">
                  Für diese Ansicht liegen noch keine Einträge vor.
                </p>
              )}

              {/* Jetzt-Linie: liegt über allen Zeilen, aber hinter der
                  Beschriftungsspalte (die klebt links mit höherem z-index) */}
              {nowMinute !== null && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-20 border-l-2 border-accent-500"
                  style={{ left: labelW + nowMinute * pxPerMinute }}
                >
                  <span className="absolute -top-0.5 left-0 -translate-x-1/2 rounded-full bg-accent-500 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                    {hm(now)}z
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {multiAirport
            ? "Farbton zeigt den Airport, die Helligkeit die Ebene (Delivery hell bis Center dunkel)."
            : "Farbe zeigt die Art der Position (Delivery, Ground, Tower, Approach, Center)."}
          {nowMinute !== null && " Die farbige Linie markiert die aktuelle Zeit."}
        </p>
      </CardContent>
    </Card>
  );
}
