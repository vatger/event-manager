import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  getRosterForEvent,
  validateAssignment,
} from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";
import {
  blockLabel,
  logRosterActivity,
  personLabel,
  timeRange,
  userName,
} from "@/lib/roster/rosterActivity";

const createSchema = z
  .object({
    // Fehlt nur bei persönlichen Blöcken, die in der Zeile einer Person stehen
    stationId: z.number().int().nullable().optional(),
    type: z.enum(["controller", "custom", "personal"]).default("controller"),
    userCID: z.number().int().optional(),
    label: z.string().max(60).optional(),
    color: z.string().max(30).optional(),
    startTime: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startTime" }),
    endTime: z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid endTime" }),
  })
  .refine(
    (d) =>
      d.type === "custom"
        ? !!d.label && d.stationId != null
        : d.type === "personal"
        ? !!d.label && !!d.userCID && d.stationId == null
        : !!d.userCID && d.stationId != null,
    {
      message:
        "Controller-Block braucht Station und userCID, Custom-Block Station und label, persönlicher Block userCID und label ohne Station",
    }
  );

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

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
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

  const isCustom = parsed.data.type === "custom";
  const isPersonal = parsed.data.type === "personal";
  const input = {
    stationId: isPersonal ? null : parsed.data.stationId ?? null,
    type: parsed.data.type,
    userCID: isCustom ? null : parsed.data.userCID ?? null,
    label: isCustom || isPersonal ? parsed.data.label?.trim() ?? null : null,
    color: isCustom || isPersonal ? parsed.data.color ?? null : null,
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

  const station = roster.stations.find((s) => s.id === input.stationId);
  const who = await userName(input.userCID);
  await logRosterActivity({
    rosterId: roster.id,
    actorCID: Number(user.cid),
    action: "assignment_created",
    summary: isPersonal
      ? `„${input.label}" für ${personLabel(who, input.userCID)} ${timeRange(
          input.startTime,
          input.endTime
        )} eingetragen`
      : `${blockLabel(input.type, who, input.userCID, input.label)} auf ${
          station?.callsign ?? "?"
        } ${timeRange(input.startTime, input.endTime)} eingeplant`,
    stationCallsign: station?.callsign ?? null,
    targetCID: input.userCID,
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ assignment }, { status: 201 });
}
