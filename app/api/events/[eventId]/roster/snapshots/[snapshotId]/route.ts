import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  restoreSnapshot,
  type RosterSnapshotData,
} from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

async function loadSnapshot(eventId: number, snapshotId: number) {
  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!roster) return null;
  const snapshot = await prisma.eventRosterSnapshot.findUnique({
    where: { id: snapshotId },
  });
  if (!snapshot || snapshot.rosterId !== roster.id) return null;
  return { rosterId: roster.id, snapshot };
}

// POST: Snapshot wiederherstellen (ersetzt den aktuellen Zustand)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; snapshotId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam, snapshotId: sParam } = await params;
  const eventId = Number(idParam);
  const snapshotId = Number(sParam);
  if (isNaN(eventId) || isNaN(snapshotId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const found = await loadSnapshot(eventId, snapshotId);
  if (!found) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });

  await restoreSnapshot(found.rosterId, found.snapshot.data as unknown as RosterSnapshotData);
  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true });
}

// DELETE: Snapshot löschen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; snapshotId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam, snapshotId: sParam } = await params;
  const eventId = Number(idParam);
  const snapshotId = Number(sParam);
  if (isNaN(eventId) || isNaN(snapshotId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const found = await loadSnapshot(eventId, snapshotId);
  if (!found) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });

  await prisma.eventRosterSnapshot.delete({ where: { id: snapshotId } });
  return NextResponse.json({ success: true });
}
