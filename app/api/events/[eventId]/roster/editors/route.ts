import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canManageRosterEditors,
  canViewEventRoster,
} from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

const postSchema = z.object({ userCID: z.number().int() });

// GET: Liste der explizit eingetragenen Roster-Bearbeiter (inkl. Namen)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  if (!(await canViewEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!roster) return NextResponse.json({ editors: [] });

  const editors = await prisma.eventRosterEditor.findMany({
    where: { rosterId: roster.id },
    orderBy: { createdAt: "asc" },
  });
  const cids = editors.map((e) => e.userCID);
  const users = await prisma.user.findMany({
    where: { cid: { in: cids } },
    select: { cid: true, name: true, rating: true },
  });
  const byCid = new Map(users.map((u) => [u.cid, u]));

  return NextResponse.json({
    editors: editors.map((e) => ({
      userCID: e.userCID,
      name: byCid.get(e.userCID)?.name ?? `CID ${e.userCID}`,
      rating: byCid.get(e.userCID)?.rating ?? null,
      addedByCID: e.addedByCID,
    })),
  });
}

// POST: Bearbeiter hinzufügen
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  if (!(await canManageRosterEditors(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { cid: parsed.data.userCID },
    select: { cid: true, name: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "Nutzer mit dieser CID nicht gefunden" }, { status: 404 });
  }

  await prisma.eventRosterEditor.upsert({
    where: { rosterId_userCID: { rosterId: roster.id, userCID: parsed.data.userCID } },
    create: { rosterId: roster.id, userCID: parsed.data.userCID, addedByCID: Number(user.cid) },
    update: {},
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true, name: targetUser.name }, { status: 201 });
}
