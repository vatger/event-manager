import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { isEventFirTeamMember } from "@/lib/acl/permissions";
import { canManageEventRoster, getRosterForEvent } from "@/lib/roster/eventRosterService";

/**
 * Öffentliche (Teilnehmer-)Ansicht des Besetzungsplans.
 * Sichtbar sobald das Event auf ROSTER_PUBLISHED steht; das Event-Team
 * sieht den Plan auch vorher (Vorschau). Interne Notizen werden nie mitgegeben.
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
  if (!published) {
    const cid = Number(user.cid);
    const isTeam =
      (await canManageEventRoster(cid, eventId)) || (await isEventFirTeamMember(cid, eventId));
    if (!isTeam) {
      return NextResponse.json({ published: false, roster: null });
    }
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster || roster.assignments.length === 0) {
    return NextResponse.json({ published, roster: null });
  }

  // Namen der eingeplanten Controller auflösen
  const cids = [...new Set(roster.assignments.map((a) => a.userCID))];
  const users = await prisma.user.findMany({
    where: { cid: { in: cids } },
    select: { cid: true, name: true },
  });
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return NextResponse.json({
    published,
    roster: {
      slotMinutes: roster.slotMinutes,
      startTime: event.startTime,
      endTime: event.endTime,
      stations: roster.stations.map((s) => ({
        id: s.id,
        callsign: s.callsign,
        sortOrder: s.sortOrder,
      })),
      assignments: roster.assignments.map((a) => ({
        id: a.id,
        stationId: a.stationId,
        userCID: a.userCID,
        name: nameByCid.get(a.userCID) ?? `CID ${a.userCID}`,
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    },
  });
}
