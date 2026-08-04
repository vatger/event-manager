import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  getRosterForEvent,
  serializeRoster,
} from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";
import { notifyRosterPublished } from "@/lib/notifications/notifyRosterPublished";
import { userHasFirPermission, isVatgerEventleitung } from "@/lib/acl/permissions";

/**
 * Veröffentlicht den aktuellen Arbeitsstand.
 *
 * Der Editor arbeitet immer am Live-Stand; Teilnehmer sehen nur, was hier
 * eingefroren wurde. Dadurch lässt sich ein bereits veröffentlichter Plan
 * weiter umbauen, ohne dass jede Zwischenänderung sofort nach außen geht.
 * Erst beim erneuten Aufruf werden die Änderungen sichtbar.
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

  const cid = Number(user.cid);
  if (!(await canEditEventRoster(cid, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  // Erstveröffentlichung setzt zusätzlich den Event-Status – dafür gilt die
  // bestehende, strengere Berechtigung.
  const firstPublish = event.status !== "ROSTER_PUBLISHED";
  if (firstPublish) {
    const allowed =
      (await isVatgerEventleitung(cid)) ||
      (event.firCode
        ? (await userHasFirPermission(cid, event.firCode, "roster.publish")) ||
          (await userHasFirPermission(cid, event.firCode, "event.edit"))
        : false);
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Zum erstmaligen Veröffentlichen wird roster.publish oder event.edit benötigt",
        },
        { status: 403 }
      );
    }
  }

  await prisma.eventRoster.update({
    where: { id: roster.id },
    data: {
      publishedAt: new Date(),
      publishedData: JSON.parse(JSON.stringify(serializeRoster(roster))),
    },
  });

  let notified = 0;
  if (firstPublish) {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: "ROSTER_PUBLISHED" },
    });
    notified = await notifyRosterPublished(eventId);
  }

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true, firstPublish, notified });
}
