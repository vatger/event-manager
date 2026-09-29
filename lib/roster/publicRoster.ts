import { prisma } from "@/lib/prisma";
import { hmRangeToMinutes } from "@/lib/roster/rosterTime";
import type { TimeRange } from "@/types/timerange";
import {
  getRosterForEvent,
  serializeRoster,
  type RosterSnapshotData,
} from "@/lib/roster/eventRosterService";

/**
 * Der Besetzungsplan, wie ihn Außenstehende sehen.
 *
 * Dieselbe Aufbereitung dient der Teilnehmeransicht im Eventmanager und der
 * eingebetteten Ansicht für ATCISS. Sie an einer Stelle zu halten ist keine
 * Kür: Sobald sich die beiden auseinanderentwickeln, zeigt das eine Fenster
 * etwas anderes als das andere, und niemand merkt es.
 *
 * Interne Notizen und Markierungen kommen hier grundsätzlich nicht vor.
 */

export interface PublicRosterPayload {
  slotMinutes: number;
  startTime: Date;
  endTime: Date;
  stations: { id: number; callsign: string; sortOrder: number }[];
  assignments: {
    id: number;
    /** null bei persönlichen Blöcken, die in der Zeile einer Person stehen */
    stationId: number | null;
    type: string;
    userCID: number | null;
    label: string | null;
    name: string;
    startTime: string;
    endTime: string;
  }[];
  /**
   * Nichtverfügbare Zeiten der eingeplanten Personen, laut Anmeldung.
   *
   * Nur für Leute, die im Plan stehen, und nur die Zeitfenster – nicht die
   * Anmeldung selbst. Wer Schichten tauschen will, sieht so auf einen Blick,
   * wann das Gegenüber gar nicht kann.
   */
  unavailable: Record<number, { start: string; end: string }[]>;
}

export interface PublicRosterResult {
  published: boolean;
  publishedAt: Date | null;
  briefing: string | null;
  briefingUpdatedAt: Date | null;
  roster: PublicRosterPayload | null;
  event: { id: number; name: string; startTime: Date; endTime: Date; firCode: string | null };
}

/**
 * Plan eines Events für die Anzeige aufbereiten.
 *
 * `livePreview` erlaubt dem Event-Team den Blick auf den Arbeitsstand, bevor
 * veröffentlicht ist. Für alle anderen zählt ausschließlich die veröffentlichte
 * Fassung – sonst gingen Zwischenstände nach außen, während das Team noch
 * umbaut.
 */
export async function buildPublicRoster(
  eventId: number,
  livePreview = false
): Promise<PublicRosterResult | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true, startTime: true, endTime: true, firCode: true },
  });
  if (!event) return null;

  const published = event.status === "ROSTER_PUBLISHED";
  const base = {
    published,
    publishedAt: null,
    briefing: null,
    briefingUpdatedAt: null,
    roster: null,
    event: {
      id: event.id,
      name: event.name,
      startTime: event.startTime,
      endTime: event.endTime,
      firCode: event.firCode,
    },
  } satisfies PublicRosterResult;

  if (!published && !livePreview) return base;

  const roster = await getRosterForEvent(eventId);
  if (!roster) return base;

  // Das Briefing hängt nicht am Veröffentlichen-Stand der Zuweisungen – es
  // soll auch sichtbar sein, bevor überhaupt jemand eingeteilt ist.
  const withBriefing = {
    ...base,
    publishedAt: roster.publishedAt,
    briefing: roster.briefing,
    briefingUpdatedAt: roster.briefingUpdatedAt,
  };

  // Veröffentlichte Fassung bevorzugen; für Rosters aus der Zeit vor dieser
  // Trennung (publishedData noch leer) auf den Live-Stand zurückfallen.
  const source: RosterSnapshotData =
    published && roster.publishedData
      ? (roster.publishedData as unknown as RosterSnapshotData)
      : serializeRoster(roster);

  if (source.assignments.length === 0) return withBriefing;

  // Namen der eingeplanten Controller auflösen (Custom-Blöcke haben keine CID)
  const cids = [
    ...new Set(
      source.assignments.map((a) => a.userCID).filter((c): c is number => typeof c === "number")
    ),
  ];
  const users = await prisma.user.findMany({
    where: { cid: { in: cids } },
    select: { cid: true, name: true },
  });
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  // Nichtverfügbarkeit der eingeplanten Personen. Die Anmeldung hält sie als
  // Uhrzeiten ("HH:mm"); für die Anzeige braucht es echte Zeitpunkte.
  const totalMinutes = Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60000);
  const signups = cids.length
    ? await prisma.eventSignup.findMany({
        where: { eventId, userCID: { in: cids }, deletedAt: null },
        select: { userCID: true, availability: true },
      })
    : [];
  const unavailable: Record<number, { start: string; end: string }[]> = {};
  for (const signup of signups) {
    const ranges = ((signup.availability as { unavailable?: TimeRange[] } | null)?.unavailable ?? [])
      .map((r) => hmRangeToMinutes(r, event.startTime, totalMinutes))
      .filter((r): r is { start: number; end: number } => r !== null)
      .map((r) => ({
        start: new Date(event.startTime.getTime() + r.start * 60000).toISOString(),
        end: new Date(event.startTime.getTime() + r.end * 60000).toISOString(),
      }));
    if (ranges.length > 0) unavailable[signup.userCID] = ranges;
  }

  // Snapshots referenzieren Stationen über das Callsign; für die Anzeige
  // brauchen wir wieder stabile IDs.
  const stationIdByCallsign = new Map(source.stations.map((s, i) => [s.callsign, i + 1] as const));

  return {
    ...withBriefing,
    roster: {
      slotMinutes: source.slotMinutes,
      startTime: event.startTime,
      endTime: event.endTime,
      stations: [...source.stations]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          id: stationIdByCallsign.get(s.callsign)!,
          callsign: s.callsign,
          sortOrder: s.sortOrder,
        })),
      assignments: source.assignments.map((a, i) => ({
        id: i + 1,
        // Persönliche Blöcke ("Mentor") stehen an keiner Station
        stationId: a.stationCallsign ? stationIdByCallsign.get(a.stationCallsign) ?? 0 : null,
        type: a.type,
        userCID: a.userCID,
        label: a.label,
        name:
          a.type === "custom"
            ? a.label ?? "Custom"
            : nameByCid.get(a.userCID ?? -1) ?? `CID ${a.userCID}`,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
      unavailable,
    },
  };
}
