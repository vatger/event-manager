import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster, getRosterForEvent } from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

const swapSchema = z.object({
  a: z.number().int(),
  b: z.number().int(),
});

/**
 * Zwei Schichten tauschen ihre Controller.
 *
 * Als zwei getrennte Änderungen geht das nicht: Die erste würde daran
 * scheitern, dass die Zielschicht noch besetzt ist. Deshalb passiert der Tausch
 * hier in einem Zug – Stationen und Zeiten bleiben, nur die Personen wechseln.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = swapSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const { a: aId, b: bId } = parsed.data;
  if (aId === bId) return NextResponse.json({ error: "Gleiche Schicht" }, { status: 400 });

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const a = roster.assignments.find((x) => x.id === aId);
  const b = roster.assignments.find((x) => x.id === bId);
  if (!a || !b) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  if (a.type !== "controller" || b.type !== "controller" || !a.userCID || !b.userCID) {
    return NextResponse.json(
      { error: "Nur Controller-Schichten lassen sich tauschen", code: "not_controller" },
      { status: 409 }
    );
  }

  // Stationen und Zeiten bleiben, also kann nur eine Doppelbelegung der
  // getauschten Personen mit einer dritten Schicht neu entstehen.
  const clash = (cid: number, target: typeof a) =>
    roster.assignments.find(
      (x) =>
        x.id !== a.id &&
        x.id !== b.id &&
        x.userCID === cid &&
        x.startTime < target.endTime &&
        target.startTime < x.endTime
    );

  const clashA = clash(b.userCID, a);
  const clashB = clash(a.userCID, b);
  if (clashA || clashB) {
    const station = roster.stations.find(
      (s) => s.id === (clashA ?? clashB)!.stationId
    );
    return NextResponse.json(
      {
        error: `Tausch nicht möglich – jemand wäre dann doppelt eingeplant (${
          station?.callsign ?? "?"
        })`,
        code: "overlap",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.eventRosterAssignment.update({
      where: { id: a.id },
      data: { userCID: b.userCID },
    }),
    prisma.eventRosterAssignment.update({
      where: { id: b.id },
      data: { userCID: a.userCID },
    }),
  ]);

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true });
}
