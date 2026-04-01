import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageEventTasks } from "@/lib/acl/permissions";
import { z } from "zod";

/**
 * GET /api/events/[eventId]/tasks
 * List all tasks for an event, ordered by sortOrder.
 */
export async function GET(
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

  const tasks = await prisma.eventTask.findMany({
    where: { eventId: id },
    include: {
      assignee: { select: { cid: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(tasks);
}

// --- Validation Schema for creating a custom task ---
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format",
    })
    .optional()
    .nullable(),
  assigneeCID: z.number().int().optional().nullable(),
});

/**
 * POST /api/events/[eventId]/tasks
 * Create a custom task for an event.
 */
export async function POST(
  req: NextRequest,
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

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Determine the next sortOrder
  const maxSort = await prisma.eventTask.aggregate({
    where: { eventId: id },
    _max: { sortOrder: true },
  });

  const task = await prisma.eventTask.create({
    data: {
      eventId: id,
      type: "CUSTOM",
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeCID: parsed.data.assigneeCID ?? null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    include: {
      assignee: { select: { cid: true, name: true } },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
