import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canViewEventRoster,
  getRosterForEvent,
  serializeRoster,
  type RosterSnapshotData,
} from "@/lib/roster/eventRosterService";

/**
 * Öffentliche (Teilnehmer-)Ansicht des Besetzungsplans.
 *
 * Gezeigt wird die zuletzt veröffentlichte Fassung (publishedData), nicht der
 * Arbeitsstand des Editors – so kann das Team einen bereits veröffentlichten
 * Plan weiter umbauen, ohne dass Zwischenstände nach außen gehen.
 * Das Event-Team sieht den Plan auch vor der Veröffentlichung als Vorschau,
 * dann allerdings den Live-Stand. Interne Notizen werden nie mitgegeben.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, startTime: true, endTime: true },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const published = event.status === "ROSTER_PUBLISHED";
  const isTeam = await canViewEventRoster(Number(user.cid), eventId);
  if (!published && !isTeam) {
    return NextResponse.json({ published: false, roster: null });
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ published, roster: null });

  // Das Briefing hängt nicht am Veröffentlichen-Stand der Zuweisungen – es
  // soll auch sichtbar sein, bevor überhaupt jemand eingeteilt ist.
  const briefing = roster.briefing;
  const briefingUpdatedAt = roster.briefingUpdatedAt;

  // Veröffentlichte Fassung bevorzugen; für Rosters aus der Zeit vor dieser
  // Trennung (publishedData noch leer) auf den Live-Stand zurückfallen.
  const source: RosterSnapshotData =
    published && roster.publishedData
      ? (roster.publishedData as unknown as RosterSnapshotData)
      : serializeRoster(roster);

  if (source.assignments.length === 0) {
    return NextResponse.json({ published, roster: null, briefing, briefingUpdatedAt });
  }

  // Namen der eingeplanten Controller auflösen (Custom-Blöcke haben keine CID)
  const cids = [
    ...new Set(
      source.assignments
        .map((a) => a.userCID)
        .filter((c): c is number => typeof c === "number")
    ),
  ];
  const users = await prisma.user.findMany({
    where: { cid: { in: cids } },
    select: { cid: true, name: true },
  });
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  // Snapshots referenzieren Stationen über das Callsign; für die Anzeige
  // brauchen wir wieder stabile IDs.
  const stationIdByCallsign = new Map(
    source.stations.map((s, i) => [s.callsign, i + 1] as const)
  );

  return NextResponse.json({
    published,
    publishedAt: roster.publishedAt,
    briefing,
    briefingUpdatedAt,
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
  });
}
