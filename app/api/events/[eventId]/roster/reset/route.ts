import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  getRosterForEvent,
  serializeRoster,
} from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

const bodySchema = z.object({
  /** Vor dem Zurücksetzen einen Snapshot anlegen (Standard: ja) */
  snapshot: z.boolean().optional(),
  snapshotName: z.string().min(1).max(80).optional(),
  /** Auch die Stationen entfernen, nicht nur die Besetzung */
  includeStations: z.boolean().optional(),
});

/**
 * Setzt den Besetzungsplan zurück: alle Blöcke werden entfernt, die Stationen
 * bleiben standardmäßig erhalten. Weil das viel Arbeit vernichten kann, wird
 * vorher automatisch ein Snapshot angelegt, sofern nicht abgewählt.
 * Notizen und Bearbeiterliste bleiben unberührt.
 */
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const withSnapshot = parsed.data.snapshot !== false;
  const includeStations = parsed.data.includeStations === true;

  let snapshotId: number | null = null;
  if (withSnapshot) {
    const name =
      parsed.data.snapshotName ??
      `Vor dem Zurücksetzen · ${new Date().toLocaleString("de-DE", { timeZone: "UTC" })} UTC`;
    const created = await prisma.eventRosterSnapshot.create({
      data: {
        rosterId: roster.id,
        name,
        data: JSON.parse(JSON.stringify(serializeRoster(roster))),
        createdByCID: Number(user.cid),
      },
      select: { id: true },
    });
    snapshotId = created.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.eventRosterAssignment.deleteMany({ where: { rosterId: roster.id } });
    if (includeStations) {
      await tx.eventRosterStation.deleteMany({ where: { rosterId: roster.id } });
    }
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true, snapshotId });
}
