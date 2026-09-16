import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { canViewEventRoster } from "@/lib/roster/eventRosterService";
import { buildPublicRoster } from "@/lib/roster/publicRoster";

/**
 * Öffentliche (Teilnehmer-)Ansicht des Besetzungsplans.
 *
 * Gezeigt wird die zuletzt veröffentlichte Fassung (publishedData), nicht der
 * Arbeitsstand des Editors – so kann das Team einen bereits veröffentlichten
 * Plan weiter umbauen, ohne dass Zwischenstände nach außen gehen.
 * Das Event-Team sieht den Plan auch vor der Veröffentlichung als Vorschau,
 * dann allerdings den Live-Stand. Interne Notizen werden nie mitgegeben.
 *
 * Die Aufbereitung selbst liegt in lib/roster/publicRoster, weil die
 * eingebettete Ansicht für ATCISS denselben Plan zeigen muss.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const isTeam = await canViewEventRoster(Number(user.cid), eventId);
  const result = await buildPublicRoster(eventId, isTeam);
  if (!result) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  return NextResponse.json({
    published: result.published,
    publishedAt: result.publishedAt,
    briefing: result.briefing,
    briefingUpdatedAt: result.briefingUpdatedAt,
    roster: result.roster,
  });
}
