import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster } from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";

const putSchema = z.object({
  key: z.string().min(1).max(300),
  dismissed: z.boolean(),
});

/**
 * Planungshinweise bewusst ausblenden.
 *
 * Die Liste hängt am Roster, nicht am einzelnen Bearbeiter: Wer geprüft hat,
 * dass ein Hinweis in Ordnung geht, erledigt das für das ganze Team. Ändert
 * sich der zugrunde liegende Block, ändert sich sein Schlüssel und der Hinweis
 * erscheint wieder – ausgeblendet bleibt also nur der geprüfte Sachverhalt.
 */
export async function PUT(
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

  const roster = await prisma.eventRoster.findUnique({ where: { eventId } });
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const current = Array.isArray(roster.dismissedWarnings)
    ? (roster.dismissedWarnings as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  const { key, dismissed } = parsed.data;
  const next = dismissed ? [...new Set([...current, key])] : current.filter((k) => k !== key);

  await prisma.eventRoster.update({
    where: { id: roster.id },
    data: { dismissedWarnings: next },
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({ success: true, dismissedWarnings: next });
}
