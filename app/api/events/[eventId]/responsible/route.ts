import { NextResponse } from "next/server";
import { logEventActivity } from "@/lib/events/eventActivity";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/getSessionUser";
import { denyMissing, getEventCapabilities } from "@/lib/events/eventAccess";

/**
 * GET /api/events/[eventId]/responsible
 * Returns the list of responsible persons for an event.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (!prisma) return new Response("Service unavailable", { status: 503 });

  const { eventId } = await params;
  const evId = Number(eventId);

  const responsibles = await prisma.eventResponsible.findMany({
    where: { eventId: evId },
    include: { user: { select: { cid: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(responsibles.map((r) => r.user));
}

const postSchema = z.object({
  cid: z.number().int().positive(),
});

/**
 * POST /api/events/[eventId]/responsible
 * Trägt eine Person als Verantwortliche ein. Andere einzutragen verlangt
 * „Stammdaten bearbeiten“; sich selbst darf jedes Mitglied des
 * Eventdepartments der FIR eintragen.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (!prisma) return new Response("Service unavailable", { status: 503 });

  const { eventId } = await params;
  const evId = Number(eventId);

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const capabilities = await getEventCapabilities(Number(user.cid), evId);
  if (!capabilities) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  const isSelf = parsed.data.cid === Number(user.cid);
  const denied = denyMissing(capabilities, [isSelf && !capabilities.manageResponsibles ? "selfAssign" : "manageResponsibles"]);
  if (denied) return denied;

  // Ensure the target user exists
  const targetUser = await prisma.user.findUnique({ where: { cid: parsed.data.cid }, select: { cid: true, name: true } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.eventResponsible.findUnique({
    where: { eventId_userCID: { eventId: evId, userCID: parsed.data.cid } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.eventResponsible.create({ data: { eventId: evId, userCID: parsed.data.cid } });
    await logEventActivity({
      eventId: evId,
      actorCID: Number(user.cid),
      category: "team",
      action: isSelf ? "responsible_self_added" : "responsible_added",
      summary: isSelf
        ? "Hat sich als verantwortlich eingetragen"
        : `${targetUser.name} als verantwortlich eingetragen`,
      details: { targetCID: targetUser.cid },
    });
  }

  return NextResponse.json(targetUser, { status: 201 });
}
