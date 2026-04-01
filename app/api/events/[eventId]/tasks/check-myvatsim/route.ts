import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { isEventFirTeamMember, canManageEventTasks } from "@/lib/acl/permissions";
import { checkOccurrenceInMyVatsim } from "@/lib/weeklys/myVatsimService";

/**
 * POST /api/events/[eventId]/tasks/check-myvatsim
 * Checks if the event is registered in myVATSIM and updates the
 * REGISTER_MYVATSIM task accordingly.
 * Any FIR team member can trigger this check.
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
  const userCid = Number(user.cid);

  // Any FIR team member can check myVATSIM status
  if (!await isEventFirTeamMember(userCid, id) && !await canManageEventTasks(userCid, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { name: true, startTime: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Find the REGISTER_MYVATSIM task
  const task = await prisma.eventTask.findFirst({
    where: { eventId: id, type: "REGISTER_MYVATSIM" },
  });
  if (!task) {
    return NextResponse.json({ error: "No myVATSIM task found for this event" }, { status: 404 });
  }

  // Check myVATSIM API
  const isRegistered = await checkOccurrenceInMyVatsim(event.name, event.startTime);

  // Update the task — auto-mark as DONE when registered
  const updateData: Record<string, unknown> = {
    myVatsimRegistered: isRegistered,
  };
  if (isRegistered && task.status !== "DONE" && task.status !== "SKIPPED") {
    updateData.status = "DONE";
    updateData.completedAt = new Date();
  }

  const updated = await prisma.eventTask.update({
    where: { id: task.id },
    data: updateData,
    include: {
      assignee: { select: { cid: true, name: true } },
    },
  });

  return NextResponse.json({
    registered: isRegistered,
    task: updated,
  });
}
