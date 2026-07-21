import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster } from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

const putSchema = z.object({
  userCID: z.number().int(),
  note: z.string().max(2000),
});

// PUT: Interne Notiz zu einem Controller setzen (leer = löschen)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await prisma.eventRoster.findUnique({ where: { eventId } });
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { userCID, note } = parsed.data;
  const trimmed = note.trim();

  if (trimmed === "") {
    await prisma.eventRosterNote.deleteMany({
      where: { rosterId: roster.id, userCID },
    });
  } else {
    await prisma.eventRosterNote.upsert({
      where: { rosterId_userCID: { rosterId: roster.id, userCID } },
      create: { rosterId: roster.id, userCID, note: trimmed, authorCID: Number(user.cid) },
      update: { note: trimmed, authorCID: Number(user.cid) },
    });
  }

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true });
}
