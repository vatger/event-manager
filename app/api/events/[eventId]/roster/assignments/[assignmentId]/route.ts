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
  timeRange,
  userName,
  userNames,
  type RosterActivityAction,
} from "@/lib/roster/rosterActivity";

const updateSchema = z.object({
  stationId: z.number().int().optional(),
  userCID: z.number().int().optional(),
  label: z.string().max(60).optional(),
  color: z.string().max(30).optional(),
  startTime: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid startTime" })
    .optional(),
  endTime: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid endTime" })
    .optional(),
});

async function authorize(eventId: number) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { event, user };
}

// PATCH: Zuweisung verschieben / verlängern / Station oder Controller wechseln
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; assignmentId: string }> }
) {
  const { eventId: idParam, assignmentId: aParam } = await params;
  const eventId = Number(idParam);
  const assignmentId = Number(aParam);
  if (isNaN(eventId) || isNaN(assignmentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const auth = await authorize(eventId);
  if ("error" in auth) return auth.error;

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const existing = roster.assignments.find((a) => a.id === assignmentId);
  if (!existing) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const input = {
    stationId: parsed.data.stationId ?? existing.stationId,
    type: existing.type as "controller" | "custom",
    userCID: parsed.data.userCID ?? existing.userCID,
    label: parsed.data.label !== undefined ? parsed.data.label.trim() : existing.label,
    color: parsed.data.color !== undefined ? parsed.data.color : existing.color,
    startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : existing.startTime,
    endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : existing.endTime,
  };

  const validationError = await validateAssignment(auth.event, roster, input, assignmentId);
  if (validationError) {
    return NextResponse.json(
      { error: validationError.message, code: validationError.code },
      { status: 409 }
    );
  }

  const assignment = await prisma.eventRosterAssignment.update({
    where: { id: assignmentId },
    data: {
      stationId: input.stationId,
      userCID: input.userCID,
      label: input.label,
      color: input.color,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });

  // Was genau sich geändert hat, entscheidet über die Formulierung: „verschoben"
  // hilft beim Nachvollziehen wenig, wenn in Wahrheit die Person gewechselt hat.
  const stationBefore = roster.stations.find((s) => s.id === existing.stationId);
  const stationAfter = roster.stations.find((s) => s.id === input.stationId);
  const names = await userNames([existing.userCID, input.userCID].filter((c): c is number => !!c));
  const who = blockLabel(
    existing.type,
    names.get(existing.userCID ?? -1),
    existing.userCID,
    existing.label
  );
  const timesChanged =
    existing.startTime.getTime() !== input.startTime.getTime() ||
    existing.endTime.getTime() !== input.endTime.getTime();
  const durationBefore = existing.endTime.getTime() - existing.startTime.getTime();
  const durationAfter = input.endTime.getTime() - input.startTime.getTime();

  let action: RosterActivityAction = "assignment_moved";
  let summary: string;
  if (existing.userCID !== input.userCID && input.userCID) {
    action = "assignment_reassigned";
    summary = `${stationAfter?.callsign ?? "?"} ${timeRange(
      input.startTime,
      input.endTime
    )}: ${who} durch ${blockLabel(
      existing.type,
      names.get(input.userCID),
      input.userCID,
      input.label
    )} ersetzt`;
  } else if (existing.stationId !== input.stationId) {
    summary = `${who} von ${stationBefore?.callsign ?? "?"} ${timeRange(
      existing.startTime,
      existing.endTime
    )} auf ${stationAfter?.callsign ?? "?"} ${timeRange(
      input.startTime,
      input.endTime
    )} verschoben`;
  } else if (timesChanged && durationBefore !== durationAfter) {
    action = "assignment_resized";
    summary = `${who} auf ${stationAfter?.callsign ?? "?"} von ${timeRange(
      existing.startTime,
      existing.endTime
    )} auf ${timeRange(input.startTime, input.endTime)} geändert`;
  } else if (timesChanged) {
    summary = `${who} auf ${stationAfter?.callsign ?? "?"} von ${timeRange(
      existing.startTime,
      existing.endTime
    )} auf ${timeRange(input.startTime, input.endTime)} verschoben`;
  } else if (existing.color !== input.color) {
    action = "assignment_recolored";
    summary = `Farbe von ${who} auf ${stationAfter?.callsign ?? "?"} geändert`;
  } else {
    summary = `${who} auf ${stationAfter?.callsign ?? "?"} bearbeitet`;
  }

  await logRosterActivity({
    rosterId: roster.id,
    actorCID: Number(auth.user.cid),
    action,
    summary,
    stationCallsign: stationAfter?.callsign ?? null,
    targetCID: input.userCID,
    details: {
      before: {
        station: stationBefore?.callsign ?? null,
        start: existing.startTime.toISOString(),
        end: existing.endTime.toISOString(),
        userCID: existing.userCID,
      },
      after: {
        station: stationAfter?.callsign ?? null,
        start: input.startTime.toISOString(),
        end: input.endTime.toISOString(),
        userCID: input.userCID,
      },
    },
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ assignment });
}

// DELETE: Zuweisung entfernen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; assignmentId: string }> }
) {
  const { eventId: idParam, assignmentId: aParam } = await params;
  const eventId = Number(idParam);
  const assignmentId = Number(aParam);
  if (isNaN(eventId) || isNaN(assignmentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const auth = await authorize(eventId);
  if ("error" in auth) return auth.error;

  const assignment = await prisma.eventRosterAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const roster = await prisma.eventRoster.findUnique({ where: { eventId } });
  if (!roster || assignment.rosterId !== roster.id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const station = await prisma.eventRosterStation.findUnique({
    where: { id: assignment.stationId },
    select: { callsign: true },
  });
  await prisma.eventRosterAssignment.delete({ where: { id: assignmentId } });

  await logRosterActivity({
    rosterId: roster.id,
    actorCID: Number(auth.user.cid),
    action: "assignment_deleted",
    summary: `${blockLabel(
      assignment.type,
      await userName(assignment.userCID),
      assignment.userCID,
      assignment.label
    )} von ${station?.callsign ?? "?"} ${timeRange(
      assignment.startTime,
      assignment.endTime
    )} entfernt`,
    stationCallsign: station?.callsign ?? null,
    targetCID: assignment.userCID,
  });

  broadcastRosterChange(eventId, _req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true });
}
