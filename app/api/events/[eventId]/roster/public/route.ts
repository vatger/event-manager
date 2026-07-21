import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canViewEventRoster, getRosterForEvent } from "@/lib/roster/eventRosterService";

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
    if (!(await canViewEventRoster(cid, eventId))) {
      return NextResponse.json({ published: false, roster: null });
    }
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster || roster.assignments.length === 0) {
    return NextResponse.json({ published, roster: null });
  }

  // Namen der eingeplanten Controller auflösen (Custom-Blöcke haben keine CID)
  const cids = [
    ...new Set(
      roster.assignments
        .map((a) => a.userCID)
        .filter((c): c is number => typeof c === "number")
    ),
  ];
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
