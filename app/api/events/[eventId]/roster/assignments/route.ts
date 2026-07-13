import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canManageEventRoster,
  getRosterForEvent,
  validateAssignment,
} from "@/lib/roster/eventRosterService";

const createSchema = z.object({
  stationId: z.number().int(),
  userCID: z.number().int(),
  startTime: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startTime" }),
  endTime: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid endTime" }),
});

// POST: Neue Zuweisung anlegen
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (!(await canManageEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input = {
    stationId: parsed.data.stationId,
    userCID: parsed.data.userCID,
    startTime: new Date(parsed.data.startTime),
    endTime: new Date(parsed.data.endTime),
  };

  const validationError = await validateAssignment(event, roster, input);
  if (validationError) {
    return NextResponse.json(
      { error: validationError.message, code: validationError.code },
      { status: 409 }
    );
  }

  const assignment = await prisma.eventRosterAssignment.create({
    data: { rosterId: roster.id, ...input },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
