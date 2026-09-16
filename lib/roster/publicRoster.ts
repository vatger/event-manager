import { prisma } from "@/lib/prisma";
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
    stationId: number;
    type: string;
    userCID: number | null;
    label: string | null;
    name: string;
    startTime: string;
    endTime: string;
  }[];
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
        stationId: stationIdByCallsign.get(a.stationCallsign) ?? 0,
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
    },
  };
}
