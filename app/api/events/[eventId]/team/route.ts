import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";

/**
 * GET /api/events/[eventId]/team
 * Returns all FIR team members (FIR_LEITUNG + FIR_TEAM groups) for the event's FIR.
 * Used for task assignment dropdowns and responsible person selection.
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
  const event = await prisma.event.findUnique({
    where: { id: Number(eventId) },
    select: { firCode: true },
  });

  if (!event?.firCode) {
    return NextResponse.json({ error: "Event not found or has no FIR" }, { status: 404 });
  }

  // Get all members of FIR_LEITUNG and FIR_TEAM groups for this FIR
  const fir = await prisma.fIR.findUnique({
    where: { code: event.firCode },
    select: { id: true },
  });

  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  const groups = await prisma.group.findMany({
    where: {
      firId: fir.id,
      kind: { in: ["FIR_LEITUNG", "FIR_TEAM"] },
    },
    include: {
      members: {
        include: {
          user: {
            select: { cid: true, name: true, rating: true },
          },
        },
      },
    },
  });

  // Deduplicate users (a user might be in multiple groups)
  const userMap = new Map<number, { cid: number; name: string; rating: string; role: string }>();
  for (const group of groups) {
    for (const member of group.members) {
      const existing = userMap.get(member.user.cid);
      // FIR_LEITUNG takes priority over FIR_TEAM
      if (!existing || (group.kind === "FIR_LEITUNG" && existing.role !== "FIR_LEITUNG")) {
        userMap.set(member.user.cid, {
          cid: member.user.cid,
          name: member.user.name,
          rating: member.user.rating,
          role: group.kind,
        });
      }
    }
  }

  const members = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(members);
}
