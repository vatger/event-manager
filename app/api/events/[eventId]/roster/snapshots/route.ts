import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  canViewEventRoster,
  getRosterForEvent,
  serializeRoster,
} from "@/lib/roster/eventRosterService";

const postSchema = z.object({ name: z.string().min(1).max(80).optional() });

// GET: Snapshot-Metadaten (ohne die schweren data-Blobs)
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
  if (!roster) return NextResponse.json({ snapshots: [] });

  const snapshots = await prisma.eventRosterSnapshot.findMany({
    where: { rosterId: roster.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdByCID: true, createdAt: true },
  });

  // Autoren-Namen auflösen
  const cids = [...new Set(snapshots.map((s) => s.createdByCID).filter((c): c is number => !!c))];
  const users = cids.length
    ? await prisma.user.findMany({ where: { cid: { in: cids } }, select: { cid: true, name: true } })
    : [];
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return NextResponse.json({
    snapshots: snapshots.map((s) => ({
      id: s.id,
      name: s.name,
      createdByName: s.createdByCID ? nameByCid.get(s.createdByCID) ?? null : null,
      createdAt: s.createdAt,
    })),
  });
}

// POST: aktuellen Zustand als Snapshot speichern
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  const name =
    parsed.success && parsed.data.name
      ? parsed.data.name
      : `Snapshot ${new Date().toLocaleString("de-DE", { timeZone: "UTC" })} UTC`;

  const data = serializeRoster(roster);
  const snapshot = await prisma.eventRosterSnapshot.create({
    data: {
      rosterId: roster.id,
      name,
      data: JSON.parse(JSON.stringify(data)),
      createdByCID: Number(user.cid),
    },
    select: { id: true, name: true, createdAt: true },
  });

  return NextResponse.json({ snapshot }, { status: 201 });
}
