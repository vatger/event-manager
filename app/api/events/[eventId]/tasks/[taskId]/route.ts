import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageEventTasks, isEventFirTeamMember } from "@/lib/acl/permissions";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE", "SKIPPED"]).optional(),
  dueDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format",
    })
    .optional()
    .nullable(),
  assigneeCID: z.number().int().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
});

/**
 * PATCH /api/events/[eventId]/tasks/[taskId]
 * Update a task (status, assignee, due date, etc.)
 * 
 * Permission levels:
 * - FIR team members: can claim (assign self), mark as done, provide bannerUrl
 * - Event responsible / FIR Eventleiter: full management (assign others, edit, skip, etc.)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; taskId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }

  const { eventId, taskId } = await params;
  const evId = Number(eventId);
  const tId = Number(taskId);
  const userCid = Number(user.cid);

  // Check permission levels
  const isManager = await canManageEventTasks(userCid, evId);
  const isTeamMember = isManager || await isEventFirTeamMember(userCid, evId);

  if (!isTeamMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existingTask = await prisma.eventTask.findFirst({
    where: { id: tId, eventId: evId },
  });
  if (!existingTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};

  // Title change — only managers, only CUSTOM tasks
  if (parsed.data.title !== undefined) {
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden: only managers can change titles" }, { status: 403 });
    }
    if (existingTask.type !== "CUSTOM") {
      return NextResponse.json({ error: "Cannot change title of default tasks" }, { status: 400 });
    }
    data.title = parsed.data.title;
  }

  // Description + deadline — only managers
  if (parsed.data.description !== undefined) {
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden: only managers can change description" }, { status: 403 });
    }
    data.description = parsed.data.description;
  }
  if (parsed.data.dueDate !== undefined) {
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden: only managers can change deadline" }, { status: 403 });
    }
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }

  // Assignee — team members can claim (assign self), managers can assign anyone
  if (parsed.data.assigneeCID !== undefined) {
    if (!isManager && parsed.data.assigneeCID !== userCid && parsed.data.assigneeCID !== null) {
      return NextResponse.json({ error: "Forbidden: you can only claim tasks for yourself" }, { status: 403 });
    }
    // Team members can only un-assign themselves
    if (!isManager && parsed.data.assigneeCID === null && existingTask.assigneeCID !== userCid) {
      return NextResponse.json({ error: "Forbidden: you can only un-assign yourself" }, { status: 403 });
    }
    data.assigneeCID = parsed.data.assigneeCID;
  }

  // Status transitions
  if (parsed.data.status !== undefined) {
    const newStatus = parsed.data.status;
    // Team members can mark DONE or set IN_PROGRESS, managers can do everything
    if (!isManager && newStatus === "SKIPPED") {
      return NextResponse.json({ error: "Forbidden: only managers can skip tasks" }, { status: 403 });
    }
    // Team members can only mark tasks as DONE if they are assigned to them
    if (!isManager && newStatus === "DONE" && existingTask.assigneeCID !== userCid) {
      return NextResponse.json({ error: "Du musst die Aufgabe erst übernehmen, bevor du sie als erledigt markieren kannst" }, { status: 403 });
    }
    // Team members can only reopen tasks they are assigned to
    if (!isManager && newStatus === "OPEN" && existingTask.assigneeCID !== userCid) {
      return NextResponse.json({ error: "Du kannst nur deine eigenen Aufgaben wieder öffnen" }, { status: 403 });
    }

    data.status = newStatus;
    if (newStatus === "DONE") {
      data.completedAt = new Date();
    } else if (existingTask.status === "DONE") {
      data.completedAt = null;
    }
  }

  // Handle banner URL for CREATE_BANNER task — team members can provide this when completing
  if (parsed.data.bannerUrl !== undefined && existingTask.type === "CREATE_BANNER") {
    await prisma.event.update({
      where: { id: evId },
      data: { bannerUrl: parsed.data.bannerUrl },
    });
  }

  const updated = await prisma.eventTask.update({
    where: { id: tId },
    data,
    include: {
      assignee: { select: { cid: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/events/[eventId]/tasks/[taskId]
 * Delete a task. Only event managers (responsible / FIR Eventleiter) can delete.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; taskId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }

  const { eventId, taskId } = await params;
  const evId = Number(eventId);
  const tId = Number(taskId);

  if (!await canManageEventTasks(Number(user.cid), evId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const task = await prisma.eventTask.findFirst({
    where: { id: tId, eventId: evId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.eventTask.delete({ where: { id: tId } });

  return NextResponse.json({ message: "Task deleted" });
}
