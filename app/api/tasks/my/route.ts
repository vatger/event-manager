import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { hasAdminAccess } from "@/lib/acl/permissions";

/**
 * GET /api/tasks/my
 * Returns tasks assigned to the current user, plus optionally all tasks.
 * Query params:
 *   - view: "mine" | "all" (default: "mine")
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }

  const cid = Number(user.cid);

  if (!await hasAdminAccess(cid)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const view = req.nextUrl.searchParams.get("view") || "mine";

  const eventInclude = {
    select: { id: true, name: true, startTime: true, firCode: true },
  };
  const assigneeInclude = {
    select: { cid: true, name: true },
  };

  // Always fetch myTasks (assigned to current user, open/in-progress)
  const myTasks = await prisma.eventTask.findMany({
    where: {
      assigneeCID: cid,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    include: {
      event: eventInclude,
      assignee: assigneeInclude,
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
  });

  if (view === "mine") {
    return NextResponse.json({ myTasks, allTasks: [] });
  }

  // view === "all": return all tasks across non-cancelled events (all statuses)
  const allTasks = await prisma.eventTask.findMany({
    where: {
      event: {
        status: { notIn: ["CANCELLED"] },
      },
    },
    include: {
      event: eventInclude,
      assignee: assigneeInclude,
    },
    orderBy: [
      { event: { startTime: "asc" } },
      { sortOrder: "asc" },
    ],
  });

  return NextResponse.json({ myTasks, allTasks });
}
