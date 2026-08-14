import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canViewEventRoster,
  getRosterForEvent,
  hasUnpublishedChanges,
} from "@/lib/roster/eventRosterService";

/**
 * Nur der Veröffentlichungsstand – bewusst schlank.
 *
 * Der Editor arbeitet optimistisch und lädt nach eigenen Änderungen nicht das
 * ganze Roster neu (das würde den lokalen Stand überschreiben und flackern).
 * Ob der Arbeitsstand von der veröffentlichten Fassung abweicht, weiß aber nur
 * der Server – dafür genügt diese Abfrage.
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

  if (!(await canViewEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await getRosterForEvent(eventId);
  return NextResponse.json({
    publishedAt: roster?.publishedAt ?? null,
    hasUnpublishedChanges: roster ? hasUnpublishedChanges(roster) : false,
  });
}
