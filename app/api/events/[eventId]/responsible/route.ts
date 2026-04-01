import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/getSessionUser";
import { userhasPermissiononEvent } from "@/lib/acl/permissions";

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
 * Adds a responsible person to an event.
 * Requires event.edit permission.
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

  if (!await userhasPermissiononEvent(Number(user.cid), evId, "event.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Ensure the target user exists
  const targetUser = await prisma.user.findUnique({ where: { cid: parsed.data.cid }, select: { cid: true, name: true } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Upsert to avoid duplicate errors
  await prisma.eventResponsible.upsert({
    where: { eventId_userCID: { eventId: evId, userCID: parsed.data.cid } },
    create: { eventId: evId, userCID: parsed.data.cid },
    update: {},
  });

  return NextResponse.json(targetUser, { status: 201 });
}
