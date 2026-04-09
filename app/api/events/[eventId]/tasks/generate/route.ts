import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageEventTasks } from "@/lib/acl/permissions";
import { getTaskTemplatesForFir, calculateDeadline } from "@/config/taskTemplates";

/**
 * POST /api/events/[eventId]/tasks/generate
 * Generate default tasks for an event (idempotent — skips types that already exist).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }

  const { eventId } = await params;
  const id = Number(eventId);

  if (!await canManageEventTasks(Number(user.cid), id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, startTime: true, firCode: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const templates = getTaskTemplatesForFir(event.firCode);

  // Check which default task types already exist for this event
  const existingTasks = await prisma.eventTask.findMany({
    where: { eventId: id, type: { not: "CUSTOM" } },
    select: { type: true },
  });
  const existingTypes = new Set(existingTasks.map((t) => t.type));

  const toCreate = templates.filter(
    (tmpl) => !existingTypes.has(tmpl.type)
  );

  if (toCreate.length === 0) {
    return NextResponse.json({ message: "All default tasks already exist", created: 0 });
  }

  const created = await prisma.$transaction(
    toCreate.map((tmpl) =>
      prisma.eventTask.create({
        data: {
          eventId: id,
          type: tmpl.type,
          title: tmpl.title,
          description: tmpl.description,
          dueDate: calculateDeadline(event.startTime, tmpl.deadlineDaysBefore),
        },
      })
    )
  );

  return NextResponse.json({ message: "Tasks generated", created: created.length, tasks: created });
}
