import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageRosterEditors } from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

// DELETE: Bearbeiter entfernen
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; cid: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam, cid: cidParam } = await params;
  const eventId = Number(idParam);
  const cid = Number(cidParam);
  if (isNaN(eventId) || isNaN(cid)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!(await canManageRosterEditors(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  await prisma.eventRosterEditor.deleteMany({
    where: { rosterId: roster.id, userCID: cid },
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true });
}
