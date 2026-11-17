import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { denyMissing, getEventCapabilities } from "@/lib/events/eventAccess";

/**
 * DELETE /api/events/[eventId]/responsible/[cid]
 * Trägt eine verantwortliche Person aus. Andere austragen verlangt
 * „Stammdaten bearbeiten“; sich selbst austragen darf jeder.
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

  if (userCID !== Number(user.cid)) {
    const capabilities = await getEventCapabilities(Number(user.cid), evId);
    if (!capabilities) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
    const denied = denyMissing(capabilities, ["manageResponsibles"]);
    if (denied) return denied;
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
