import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { userhasPermissiononEvent } from "@/lib/acl/permissions";

/**
 * DELETE /api/events/[eventId]/responsible/[cid]
 * Removes a responsible person from an event.
 * Requires event.edit permission.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; cid: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (!prisma) return new Response("Service unavailable", { status: 503 });

  const { eventId, cid } = await params;
  const evId = Number(eventId);
  const userCID = Number(cid);

  if (!await userhasPermissiononEvent(Number(user.cid), evId, "event.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.eventResponsible.findUnique({
    where: { eventId_userCID: { eventId: evId, userCID } },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.eventResponsible.delete({
    where: { eventId_userCID: { eventId: evId, userCID } },
  });

  return NextResponse.json({ message: "Verantwortlicher entfernt" });
}
