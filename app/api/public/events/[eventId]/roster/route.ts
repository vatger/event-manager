import { NextRequest, NextResponse } from "next/server";
import { buildPublicRoster } from "@/lib/roster/publicRoster";

/**
 * Veröffentlichter Besetzungsplan ohne Anmeldung.
 *
 * Grundlage der eingebetteten Ansicht: Wer ATCISS offen hat, ist nicht am
 * Eventmanager angemeldet, und ein Login in einem iframe wäre weder machbar
 * noch sinnvoll. Herausgegeben wird deshalb nur, was ohnehin veröffentlicht
 * ist – kein Arbeitsstand, keine internen Notizen, keine Anmeldedaten.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const result = await buildPublicRoster(eventId);
  if (!result) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Unveröffentlichte Pläne gibt es hier nicht einmal andeutungsweise.
  if (!result.published) {
    return NextResponse.json({ published: false, roster: null, event: null });
  }

  return NextResponse.json({
    published: true,
    publishedAt: result.publishedAt,
    briefing: result.briefing,
    event: {
      id: result.event.id,
      name: result.event.name,
      startTime: result.event.startTime,
      endTime: result.event.endTime,
      firCode: result.event.firCode,
    },
    roster: result.roster,
  });
}
