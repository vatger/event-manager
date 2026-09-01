import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster } from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

const putSchema = z.object({
  briefing: z.string().max(10000),
});

// PUT: Controller-Briefing setzen. Unabhängig vom Veröffentlichen-Stand der
// Zuweisungen selbst – Text und Links sollen sofort sichtbar sein, sobald
// das Event ROSTER_PUBLISHED ist.
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

  const trimmed = parsed.data.briefing.trim();
  const updated = await prisma.eventRoster.update({
    where: { id: roster.id },
    data: {
      briefing: trimmed || null,
      briefingUpdatedAt: new Date(),
      briefingUpdatedByCID: Number(user.cid),
    },
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({
    briefing: updated.briefing,
    briefingUpdatedAt: updated.briefingUpdatedAt,
  });
}
