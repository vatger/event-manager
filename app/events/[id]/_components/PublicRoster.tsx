"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FileText,
  Radio,
  Timer,
  User,
  Users,
  X,
} from "lucide-react";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";
import { airportTintColors, stationBlockColors } from "@/lib/roster/stationColors";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";
import type { Station } from "@/lib/stations/types";

// Layout
const LABEL_W = 152;
/** So breit darf die Beschriftungsspalte höchstens werden */
const MAX_LABEL_W = 232;
const ROW_H = 38;
const GROUP_H = 26;
/**
 * Ab hier wird eine Stunde nicht mehr schmaler gemacht – sonst würden Blöcke
 * bei langen Events unlesbar. Der Zeitstrahl füllt bis dahin immer die volle
 * verfügbare Breite; erst wenn selbst dieses Minimum die Breite sprengt,
 * erscheint ein horizontaler Scrollbalken.
 */
const MIN_PX_PER_HOUR = 64;
/** Wie oft die Jetzt-Linie nachgeführt wird */
const TICK_MS = 30_000;
/** Ab dieser Eventlänge nutzt der Plan die volle Seitenbreite */
const WIDE_FROM_HOURS = 8;
/** Unterhalb dieser Breite fallen Beschriftung und Stundenbreite kleiner aus */
const NARROW_PX = 768;
/** Merkt sich eingeklappte Airport-Gruppen je Event, wie im Roster-Editor */
const COLLAPSE_PREF_KEY = "public-roster:collapsedAirports";
/** Breite der Beschriftungsspalte, wenn sie eingeklappt ist – Platz für nur den Pfeil */
const SIDEBAR_COLLAPSED_W = 28;
/** Merkt sich, ob die Beschriftungsspalte eingeklappt ist, je Event */
const SIDEBAR_COLLAPSE_PREF_KEY = "public-roster:sidebarCollapsed";

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
  /**
   * Ohne Karte und Rahmen, für die Einbettung in ein fremdes Fenster.
   *
   * Dort ist die Karte samt Überschrift nur verschenkte Höhe: Das iframe ist
   * klein, und worum es geht, sagt die einbettende Seite bereits.
   */
  embedded?: boolean;
}

/** Zeilen der Timeline – je nach Ansicht Stationen oder Lotsen */
interface TimelineRow {
  key: string;
  title: string;
  subtitle?: string;
  /** Vollständiger Name, falls die Beschriftung gekürzt ist */
  fullTitle?: string;
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

/** Restzeit als „1:20 h" bzw. „12 min" – grob genug, um nicht zu flackern */
function untilText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
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
export default function PublicRoster({
  eventId,
  userCID,
  onLoaded,
  embedded = false,
}: PublicRosterProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const [roster, setRoster] = useState<PublicRosterData | null>(null);
  const [published, setPublished] = useState(true);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [abbreviations, setAbbreviations] = useState<Map<string, string>>(new Map());
  const [view, setView] = useState<ViewMode>("stations");
  /** Angeklickte Schicht – ihre Eckdaten stehen dann ausgeschrieben da */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);
  const ownScrollRef = useRef<HTMLDivElement>(null);

  /**
   * Eingeklappte Airport-Gruppen der Stationsansicht – auf dem Telefon ist
   * ein Plan mit mehreren Airports sonst nur durch endloses Scrollen zu
   * überblicken. Merkt sich den Zustand wie im Roster-Editor je Event.
   */
  const [collapsedAirports, setCollapsedAirports] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${COLLAPSE_PREF_KEY}:${eventId}`);
      if (stored) {
        const list = JSON.parse(stored) as string[];
        if (Array.isArray(list)) setCollapsedAirports(new Set(list));
      }
    } catch {
      // ungültiger Eintrag – ignorieren
    }
  }, [eventId]);
  const toggleAirportCollapsed = useCallback(
    (airport: string) => {
      setCollapsedAirports((prev) => {
        const next = new Set(prev);
        if (next.has(airport)) next.delete(airport);
        else next.add(airport);
        try {
          window.localStorage.setItem(
            `${COLLAPSE_PREF_KEY}:${eventId}`,
            JSON.stringify([...next])
          );
        } catch {
          // z. B. Safari Private Mode – dann bleibt der Zustand nur für die Sitzung
        }
        return next;
      });
    },
    [eventId]
  );

  /**
   * Die Beschriftungsspalte selbst lässt sich einklappen – auf dem Telefon
   * frisst sie sonst einen guten Teil der ohnehin knappen Breite, die dem
   * Zeitstrahl fehlt. Eingeklappt bleibt nur ein schmaler Pfeil zum
   * Wiederausklappen stehen.
   */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${SIDEBAR_COLLAPSE_PREF_KEY}:${eventId}`);
      if (stored) setSidebarCollapsed(stored === "1");
    } catch {
      // ungültiger Eintrag – ignorieren
    }
  }, [eventId]);
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(`${SIDEBAR_COLLAPSE_PREF_KEY}:${eventId}`, next ? "1" : "0");
      } catch {
        // z. B. Safari Private Mode – dann bleibt der Zustand nur für die Sitzung
      }
      return next;
    });
  }, [eventId]);

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

  /**
   * Breite der Beschriftungsspalte.
   *
   * Eine feste Breite schneidet lange Kennungen ab – „EDZZ_STANDBY_APP" endete
   * als „EDZZ_STANDBY_…", und die vollständige Kennung war nirgends zu sehen.
   * Sie richtet sich deshalb nach dem längsten Namen der aktuellen Ansicht,
   * gedeckelt, damit nicht ein einzelner Ausreißer den halben Plan frisst.
   * Auf dem Telefon bleibt es beim knappen Maß: Dort ist jeder Pixel
   * Beschriftung einer weniger für den Plan, und die Kürzel springen ein.
   */
  const estimatedLabelW = useMemo(() => {
    if (narrow) return 104;
    const titles =
      view === "stations"
        ? (roster?.stations ?? []).map((st) => st.callsign)
        : [
            ...new Set(
              (roster?.assignments ?? [])
                .filter((a) => a.userCID != null)
                .map((a) => a.name)
            ),
          ];
    const longest = titles.reduce((max, t) => Math.max(max, t.length), 0);
    // Grobes Maß je Zeichen: Kennungen sind Großbuchstaben und Unterstriche,
    // die in dieser Schrift breiter laufen als der Durchschnitt. Was danach
    // trotzdem noch nicht passt, korrigiert die Messung unten.
    return Math.min(MAX_LABEL_W, Math.max(LABEL_W, Math.round(longest * 8.6) + 28));
  }, [narrow, view, roster]);

  const [extraLabelW, setExtraLabelW] = useState(0);
  useEffect(() => {
    setExtraLabelW(0);
  }, [view, narrow, roster]);

  const labelW = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_W
    : Math.min(MAX_LABEL_W, estimatedLabelW + extraLabelW);

  /**
   * Tatsächlich verfügbare Breite der beiden Zeitstrahlen (Besetzungsplan und
   * die Mini-Timeline der eigenen Schichten). Damit lässt sich die Stunde so
   * breit wählen, dass der jeweilige Zeitraum genau die volle Breite füllt –
   * ohne dieses Maß bliebe ein kurzes Event auf einem breiten Bildschirm mit
   * viel Leerraum stehen.
   */
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [roster]);

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
        setBriefing(typeof data.briefing === "string" ? data.briefing : null);
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

  // Kürzel der Stationen (Datahub) – auf schmalen Bildschirmen ersetzen sie
  // das oft zu lange volle Callsign in Beschriftung und Blöcken.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stations`);
        if (!res.ok) throw new Error("failed");
        const data: { stations: Station[] } = await res.json();
        if (cancelled) return;
        setAbbreviations(
          new Map(
            data.stations
              .filter((s) => s.abbreviation)
              .map((s) => [s.callsign, s.abbreviation!])
          )
        );
      } catch {
        // Kürzel sind eine reine Anzeige-Verbesserung – ohne sie zeigen wir
        // einfach weiter das volle Callsign.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Beide Zeitstrahlen zeigen denselben Ausschnitt.
   *
   * Sie teilen sich Maßstab und Nullpunkt; liefen sie beim Scrollen
   * auseinander, stünde oben eine andere Stunde als unten – und genau dieses
   * Auseinanderlaufen hat schon zu einer Schicht geführt, die eine Stunde zu
   * früh beendet wurde.
   */
  const syncingRef = useRef(false);
  useEffect(() => {
    const main = scrollRef.current;
    const own = ownScrollRef.current;
    if (!main || !own) return;
    const link = (from: HTMLDivElement, to: HTMLDivElement) => () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      to.scrollLeft = from.scrollLeft;
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };
    const a = link(main, own);
    const b = link(own, main);
    main.addEventListener("scroll", a);
    own.addEventListener("scroll", b);
    return () => {
      main.removeEventListener("scroll", a);
      own.removeEventListener("scroll", b);
    };
  }, [roster, userCID]);

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

  const totalHours = totalMinutes / 60;

  /**
   * Breite einer Stunde: füllt die verfügbare Breite exakt aus, solange dabei
   * nicht unter das Mindestmaß gegangen wird – erst dann bestimmt das Minimum
   * die Breite und der Zeitstrahl wird scrollbar.
   */
  const pxPerHour = useMemo(() => {
    if (!totalHours || !containerWidth) return MIN_PX_PER_HOUR;
    const available = Math.max(0, containerWidth - labelW);
    return Math.max(MIN_PX_PER_HOUR, available / totalHours);
  }, [containerWidth, labelW, totalHours]);
  const pxPerMinute = pxPerHour / 60;
  const timelineWidth = totalMinutes * pxPerMinute;

  /**
   * Die Mini-Timeline der eigenen Schichten rechnete früher mit ihrer eigenen
   * Breite und ohne Beschriftungsspalte. Damit lagen 10:00z oben und 10:00z
   * unten an verschiedenen Stellen – wer die obere Leiste las und im unteren
   * Plan weitersuchte, lag um bis zu einer Stunde daneben. Beide teilen sich
   * jetzt Maßstab, Nullpunkt und Bildausschnitt.
   */
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

  const stationById = useMemo(
    () => new Map((roster?.stations ?? []).map((s) => [s.id, s])),
    [roster]
  );

  /**
   * Was steht für mich als Nächstes an?
   *
   * Während des Events ist das die einzige Frage, die zählt, und sie lässt
   * sich aus der Lage eines Balkens nur schätzen. Läuft gerade eine Schicht,
   * zählt die Zeit bis zu ihrem Ende, sonst die bis zum nächsten Beginn.
   */
  const shiftCountdown = useMemo((): { text: string; running: boolean } | null => {
    if (ownAssignments.length === 0) return null;
    const t = now.getTime();

    const current = ownAssignments.find(
      (a) => t >= new Date(a.startTime).getTime() && t < new Date(a.endTime).getTime()
    );
    if (current) {
      const station = stationById.get(current.stationId)?.callsign ?? "?";
      return {
        running: true,
        text: `${station} läuft – noch ${untilText(new Date(current.endTime).getTime() - t)}`,
      };
    }

    const next = ownAssignments.find((a) => new Date(a.startTime).getTime() > t);
    if (next) {
      const station = stationById.get(next.stationId)?.callsign ?? "?";
      return {
        running: false,
        text: `${untilText(new Date(next.startTime).getTime() - t)} bis ${station} (${hm(
          new Date(next.startTime)
        )}z)`,
      };
    }
    return { running: false, text: "Keine weitere Schicht" };
  }, [ownAssignments, now, stationById]);

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

  /**
   * Airports, die das Event wirklich definieren – ohne Center-Stationen.
   *
   * Center laufen oft unter dem FIR- statt dem Flughafenkürzel (EDMM_CTR bei
   * einem reinen München-Event statt EDDM_...). Zählten sie mit, wirkte ein
   * Single-Airport-Event mit Center-Besetzung fälschlich wie ein Multi-
   * Airport-Event. Für die Farbvergabe zählt darum nur, wie viele "echte"
   * Airports (DEL/GND/TWR/APP) im Event vorkommen.
   */
  const realAirports = useMemo(() => {
    const list: string[] = [];
    for (const st of roster?.stations ?? []) {
      if (extractStationGroup(st.callsign) === "CTR") continue;
      const ap = airportOf(st.callsign);
      if (ap && !list.includes(ap)) list.push(ap);
    }
    return list;
  }, [roster]);

  const multiAirport = realAirports.length > 1;

  /**
   * Position jeder Station innerhalb ihrer Ebene (z. B. die zweite von drei
   * Delivery-Positionen) – bei Single-Airport-Events bestimmt das die
   * Helligkeitsabstufung, da dort die Ebene statt des Airports die Farbe trägt.
   */
  const stationRankByCallsign = useMemo(() => {
    const byGroup = new Map<string, PublicRosterStation[]>();
    for (const st of roster?.stations ?? []) {
      const group = extractStationGroup(st.callsign) ?? "?";
      const list = byGroup.get(group);
      if (list) list.push(st);
      else byGroup.set(group, [st]);
    }
    const map = new Map<string, { index: number; count: number }>();
    for (const list of byGroup.values()) {
      list.forEach((st, index) => map.set(st.callsign, { index, count: list.length }));
    }
    return map;
  }, [roster]);

  /**
   * Farben einer Station – bei mehreren Airports Ton nach Airport und
   * Helligkeit nach Ebene, bei einem einzelnen Airport umgekehrt (Ton nach
   * Ebene, Helligkeit nach Position innerhalb der Ebene). Für die Farbvergabe
   * zählen nur die "echten" Airports (realAirports), nicht die volle Liste
   * inklusive Center-FIR-Kürzeln.
   */
  const toneFor = useCallback(
    (callsign: string) =>
      stationBlockColors(
        airportOf(callsign),
        extractStationGroup(callsign),
        realAirports,
        stationRankByCallsign.get(callsign)
      ),
    [realAirports, stationRankByCallsign]
  );

  /** Beschriftung einer Station – auf schmalen Geräten das Datahub-Kürzel statt des vollen Callsigns */
  const stationLabel = useCallback(
    (callsign: string) => (narrow && abbreviations.get(callsign)) || callsign,
    [narrow, abbreviations]
  );

  /** Die angeklickte Schicht samt Station – Grundlage der Detailzeile */
  const selectedBlock = useMemo(() => {
    if (selectedId === null || !roster) return null;
    const assignment = roster.assignments.find((a) => a.id === selectedId);
    if (!assignment) return null;
    return {
      assignment,
      callsign: stationById.get(assignment.stationId)?.callsign ?? "",
      name: assignment.name,
      label: assignment.label,
      type: assignment.type,
    };
  }, [selectedId, roster, stationById]);

  /** Zeilen für die gewählte Ansicht */
  const rows: TimelineRow[] = useMemo(() => {
    if (!roster) return [];
    if (view === "stations") {
      const byStation = roster.stations.map((station) => ({
        key: `station-${station.id}`,
        title: stationLabel(station.callsign),
        fullTitle: station.callsign,
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
  }, [roster, view, userCID, toMin, multiAirport, rosterAirports, stationLabel]);

  /** Anzahl Schichten je Airport – als Anhaltspunkt, wenn dessen Gruppe eingeklappt ist */
  const blocksByAirport = useMemo(() => {
    const map = new Map<string, number>();
    if (view === "stations") {
      for (const row of rows) {
        if (row.airport) map.set(row.airport, (map.get(row.airport) ?? 0) + row.blocks.length);
      }
    }
    return map;
  }, [rows, view]);

  /**
   * Nachmessen statt rechnen.
   *
   * Wie breit eine Kennung wirklich läuft, hängt an Schrift, Zoomstufe und
   * Betriebssystem – jede Schätzung liegt irgendwo daneben. Deshalb wird nach
   * dem Zeichnen geprüft, ob eine Beschriftung abgeschnitten ist, und die
   * Spalte um genau das Fehlende verbreitert. Sie wächst nur und ist gedeckelt,
   * kann also nicht hin- und herspringen.
   */
  useEffect(() => {
    if (narrow || sidebarCollapsed) return;
    const host = scrollRef.current;
    if (!host) return;
    let missing = 0;
    host.querySelectorAll<HTMLElement>("[data-roster-label]").forEach((node) => {
      missing = Math.max(missing, node.scrollWidth - node.clientWidth);
    });
    if (missing > 0) {
      setExtraLabelW((prev) => Math.min(MAX_LABEL_W - estimatedLabelW, prev + missing + 2));
    }
    // Läuft nach jeder Verbreiterung erneut, bis nichts mehr fehlt – die
    // Obergrenze macht daraus eine endliche Folge.
  }, [narrow, sidebarCollapsed, estimatedLabelW, labelW, rows]);


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
    if (embedded) {
      return (
        <div className="p-3">
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }
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

  /** Hinweise für eingeteilte Lotsen – unabhängig davon, ob schon zugewiesen ist */
  const briefingBlock = briefing ? (
    <div className="rounded-lg border border-warning-500/40 bg-warning-500/5 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-warning-800 dark:text-warning-300">
        <FileText className="h-4 w-4" />
        Controller-Briefing
      </p>
      <RichText
        text={briefing}
        className="text-sm text-foreground"
        linkClassName="text-warning-700 dark:text-warning-300"
      />
    </div>
  ) : null;

  if (!roster || !eventStart) {
    if (!briefingBlock) {
      return embedded ? (
        <p className="p-4 text-sm text-muted-foreground">
          Für dieses Event liegt kein veröffentlichter Besetzungsplan vor.
        </p>
      ) : null;
    }
    if (embedded) return <div className="p-3">{briefingBlock}</div>;
    return (
      <Card id="besetzungsplan" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            Besetzungsplan
          </CardTitle>
        </CardHeader>
        <CardContent>{briefingBlock}</CardContent>
      </Card>
    );
  }

  /** Zeitspanne einer Schicht, überall gleich geschrieben */
  const span = (a: PublicRosterAssignment) =>
    `${hm(new Date(a.startTime))}–${hm(new Date(a.endTime))}z`;

  /**
   * Kopfzeile einer Airport-Gruppe im Zeitstrahl – anklickbar, um die Gruppe
   * ein- bzw. auszuklappen. Eingeklappt bleibt sichtbar, wie viele Schichten
   * darin stecken, damit nichts spurlos verschwindet.
   */
  const renderGroupHeader = (airport: string, collapsed: boolean, blockCount: number) => {
    const tint = airportTintColors(airport, realAirports, isDark);
    return (
      // Der Farbstreifen sitzt am äußeren Element, damit er auch den Bereich
      // rechts der Zeitachse füllt – sonst bräche die Gruppe mitten in der
      // Zeile ab, wenn das Fenster breiter ist als das Event lang.
      <div
        key={`group-${airport}`}
        className="flex border-b"
        style={{ backgroundColor: tint.background }}
      >
        <button
          type="button"
          onClick={() => toggleAirportCollapsed(airport)}
          className={cn(
            "sticky left-0 z-30 border-r flex items-center gap-1.5 shrink-0 text-left",
            sidebarCollapsed ? "justify-center px-0" : "px-3"
          )}
          style={{ width: labelW, height: GROUP_H, backgroundColor: tint.background }}
          title={
            sidebarCollapsed
              ? airport
              : collapsed
              ? `${airport} ausklappen`
              : `${airport} einklappen`
          }
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
          {!sidebarCollapsed && (
            <span className="text-[11px] font-semibold tracking-wide truncate">
              {airport}
              {collapsed && blockCount > 0 && (
                <span className="ml-1.5 font-normal opacity-80">
                  · {blockCount} {blockCount === 1 ? "Schicht" : "Schichten"}
                </span>
              )}
            </span>
          )}
        </button>
        <div className="flex-1" style={{ height: GROUP_H, minWidth: timelineWidth }} />
      </div>
    );
  };

  // In der Einbettung tragen Karte und Überschrift nichts bei – das iframe ist
  // knapp bemessen, und die einbettende Seite sagt bereits, worum es geht.
  // Ein Tagesevent über zwölf Stunden bekommt in einer Spalte von 1280 Pixeln
  // keine lesbaren Blöcke mehr. Ab einer gewissen Länge bricht die Karte
  // deshalb aus der Seitenbreite aus – erst auf großen Bildschirmen, weil
  // darunter ohnehin die ganze Breite genutzt wird.
  const wide = totalHours >= WIDE_FROM_HOURS;

  // Bewusst ein Fragment und keine hier definierte Wrapper-Komponente: Eine
  // im Render angelegte Komponente ist bei jedem Durchlauf ein neuer Typ, und
  // React wirft dann den gesamten Teilbaum weg und baut ihn neu auf. Der
  // ResizeObserver hing danach an einem abgehängten Knoten, meldete Breite 0,
  // und der Zeitstrahl blieb für immer auf der Mindestbreite je Stunde
  // stehen, statt sich auf die Bildschirmbreite zu strecken.
  const content = (
    <>
        {briefingBlock}
        
        {/* Eigene Schichten */}
        {ownAssignments.length > 0 && (
          <div className="rounded-lg border border-accent-500/40 bg-accent-500/5 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <User className="h-4 w-4 text-accent-500" />
                Deine Schichten
              </p>
              {/* Was als Nächstes ansteht, ist die eine Angabe, die während des
                  Events zählt – sie steht deshalb ausgeschrieben da und muss
                  nicht aus der Lage eines Balkens abgelesen werden. */}
              {shiftCountdown && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                    shiftCountdown.running
                      ? "bg-accent-500 text-white"
                      : "bg-background/70 text-foreground"
                  )}
                >
                  <Timer className="h-3.5 w-3.5" />
                  {shiftCountdown.text}
                </span>
              )}
            </div>

            {/* Bis an die Kanten des Panels – jeder Pixel Innenabstand würde die
                Leiste gegen den Plan darunter verschieben, und genau darum
                geht es hier. */}
            <div
              ref={ownScrollRef}
              className="-mx-3 overflow-x-auto border-y border-accent-500/20 bg-background/60"
            >
              <div
                className="relative"
                style={{ width: labelW + timelineWidth, minWidth: "100%" }}
              >
                {/* Stunden-Lineal – gleiche Teilung und gleicher Nullpunkt wie
                    im Plan darunter, samt Beschriftungsspalte als Versatz. */}
                <div className="flex border-b border-accent-500/20" style={{ height: 20 }}>
                  <div
                    className={cn(
                      "sticky left-0 z-30 shrink-0 border-r border-accent-500/20 bg-background/80 text-[10px] font-semibold text-muted-foreground flex items-center",
                      sidebarCollapsed ? "justify-center px-0" : "px-2"
                    )}
                    style={{ width: labelW }}
                  >
                    {!sidebarCollapsed && "Du"}
                  </div>
                  <div
                    className="relative flex-1 overflow-hidden"
                    style={{ minWidth: timelineWidth }}
                  >
                    {hourMarks.map((mark) => (
                      <div
                        key={mark.minute}
                        className="absolute top-0 bottom-0 flex items-center border-l border-accent-500/20 pl-1 text-[9px] text-muted-foreground"
                        style={{ left: mark.minute * pxPerMinute }}
                      >
                        {mark.label}z
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex">
                  <div
                    className="sticky left-0 z-30 shrink-0 border-r border-accent-500/20 bg-background/80"
                    style={{ width: labelW, height: ROW_H }}
                  />
                  <div
                    className="relative flex-1"
                    style={{
                      minWidth: timelineWidth,
                      height: ROW_H,
                      backgroundImage: `repeating-linear-gradient(to right, rgba(120,120,120,0.14) 0 1px, transparent 1px ${pxPerHour}px), repeating-linear-gradient(to right, rgba(120,120,120,0.07) 0 1px, transparent 1px ${pxPerHour / 4}px)`,
                    }}
                  >
                    {ownAssignments.map((a) => {
                      const start = toMin(a.startTime);
                      const end = toMin(a.endTime);
                      const callsign = stationById.get(a.stationId)?.callsign ?? "?";
                      const tone = toneFor(callsign);
                      return (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => setSelectedId((prev) => (prev === a.id ? null : a.id))}
                          className={cn(
                            "absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md px-1.5 text-left text-[11px] font-medium",
                            isRunning(a) &&
                              "ring-2 ring-accent-500 ring-offset-1 ring-offset-background z-10",
                            selectedId === a.id && "outline outline-2 outline-foreground"
                          )}
                          style={{
                            left: Math.max(0, start) * pxPerMinute,
                            width: Math.max((end - start) * pxPerMinute, 8),
                            backgroundColor: tone.background,
                            color: tone.text,
                          }}
                          title={`${callsign} • ${span(a)}`}
                        >
                          <span className="truncate">
                            {stationLabel(callsign)}
                            <span className="ml-1 hidden font-normal opacity-80 sm:inline">
                              {hm(new Date(a.startTime))}–{hm(new Date(a.endTime))}
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    {/* Jetzt-Linie auch hier – sonst müsste man die Lage des
                        eigenen Balkens mit dem Plan darunter vergleichen. */}
                    {nowMinute !== null && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-20 border-l-2 border-accent-500"
                        style={{ left: nowMinute * pxPerMinute }}
                      />
                    )}
                  </div>
                </div>
              </div>
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

        {/* Eckdaten der angeklickten Schicht.
            Wie viel in einen Balken passt, hängt an seiner Länge, und lange
            Callsigns werden in der Beschriftungsspalte abgeschnitten – hier
            steht beides vollständig. */}
        {selectedBlock && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold"
              style={
                selectedBlock.type === "custom"
                  ? undefined
                  : {
                      backgroundColor: toneFor(selectedBlock.callsign).background,
                      color: toneFor(selectedBlock.callsign).text,
                    }
              }
            >
              {selectedBlock.callsign || selectedBlock.label || "Sonstiges"}
            </span>
            <span className="font-medium">{selectedBlock.name}</span>
            <span className="font-mono tabular-nums">{span(selectedBlock.assignment)}</span>
            <span className="text-xs text-muted-foreground">
              {untilText(
                new Date(selectedBlock.assignment.endTime).getTime() -
                  new Date(selectedBlock.assignment.startTime).getTime()
              )}
            </span>
            {isRunning(selectedBlock.assignment) && (
              <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                läuft
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Auswahl schließen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Zeitstrahl */}
      <div className="border rounded-lg overflow-hidden">
          <div ref={scrollRef} className="overflow-x-auto">
            <div
              className="relative"
              style={{ width: labelW + timelineWidth, minWidth: "100%" }}
            >
              {/* Stunden-Header */}
              <div className="flex border-b bg-muted/40">
                {/* Klappt die gesamte Beschriftungsspalte ein – auf dem Telefon
                    bleibt sonst kaum Platz für den eigentlichen Zeitstrahl. */}
                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  className={cn(
                    "sticky left-0 z-30 bg-muted/40 border-r py-1.5 text-xs font-semibold text-muted-foreground shrink-0 flex items-center hover:bg-muted/70 transition-colors",
                    sidebarCollapsed ? "justify-center px-0" : "justify-between px-3"
                  )}
                  style={{ width: labelW }}
                  title={sidebarCollapsed ? "Beschriftung ausklappen" : "Beschriftung einklappen"}
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <>
                      <span className="truncate">{view === "stations" ? "Station" : "Lotse"}</span>
                      <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    </>
                  )}
                </button>
                <div
                  className="relative flex-1 overflow-hidden"
                  style={{ minWidth: timelineWidth, height: 24 }}
                >
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
                const collapsedGroup =
                  view === "stations" &&
                  row.airport !== null &&
                  collapsedAirports.has(row.airport);
                // Nur die erste Zeile einer eingeklappten Gruppe trägt noch die
                // Kopfzeile; alle weiteren verschwinden komplett aus dem DOM.
                if (collapsedGroup && !groupStart) return null;
                return (
                  <div key={row.key}>
                    {groupStart &&
                      renderGroupHeader(
                        row.airport!,
                        collapsedGroup,
                        blocksByAirport.get(row.airport!) ?? 0
                      )}
                    {!collapsedGroup && (
                    <div
                      className={cn(
                        "flex border-b",
                        row.own && view === "controllers" && "bg-accent-500/5"
                      )}
                    >
                      <div
                        className={cn(
                          "sticky left-0 z-30 border-r shrink-0 flex flex-col justify-center",
                          sidebarCollapsed ? "px-0" : "px-3",
                          row.own && view === "controllers"
                            ? "bg-accent-500/10"
                            : "bg-background"
                        )}
                        style={{ width: labelW, height: ROW_H }}
                      >
                        {!sidebarCollapsed && (
                          <>
                            <span
                              data-roster-label
                              title={row.fullTitle ?? row.title}
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
                          </>
                        )}
                        {sidebarCollapsed && row.own && (
                          <span
                            className="mx-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
                            title={row.fullTitle ?? row.title}
                          />
                        )}
                      </div>
                      <div
                        className="relative flex-1"
                        style={{
                          minWidth: timelineWidth,
                          height: ROW_H,
                          // Stundenlinien kräftiger, dazwischen ein leises Viertelstunden-
                          // Raster – daran lässt sich die Länge eines Blocks leichter ablesen.
                          // flex-1 statt fester Breite: Zwingt die stellvertretende
                          // Wrapper-Mindestbreite (minWidth:100%) eine Zeile breiter als
                          // timelineWidth, füllt das Raster nach – sonst bliebe rechts ein
                          // toter, unbemusterter Rand stehen (die Airport-Kopfzeilen machen
                          // das schon länger genauso).
                          backgroundImage: `repeating-linear-gradient(to right, rgba(120,120,120,0.18) 0 1px, transparent 1px ${pxPerHour}px), repeating-linear-gradient(to right, rgba(120,120,120,0.08) 0 1px, transparent 1px ${pxPerHour / 4}px)`,
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
                              : stationLabel(callsign);
                          return (
                            <button
                              type="button"
                              key={a.id}
                              onClick={() =>
                                setSelectedId((prev) => (prev === a.id ? null : a.id))
                              }
                              className={cn(
                                "absolute top-1 bottom-1 rounded-md px-1.5 flex items-center overflow-hidden text-left text-[11px] font-medium",
                                a.type === "custom" &&
                                  "bg-station-none/70 border border-dashed border-white/40 text-white",
                                own &&
                                  "ring-2 ring-offset-1 ring-accent-500 ring-offset-background z-10",
                                selectedId === a.id && "outline outline-2 outline-foreground z-10"
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
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    )}
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
    </>
  );

  if (embedded) return <div className="space-y-3 p-2">{content}</div>;

  return (
    <Card
      id="besetzungsplan"
      className={cn(
        "scroll-mt-20",
        wide && "lg:mx-[calc(50%-50vw+0.5rem)] lg:w-[calc(100vw-1rem)]"
      )}
    >
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
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  );
}
