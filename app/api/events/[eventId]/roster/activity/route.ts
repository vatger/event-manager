import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canViewEventRoster } from "@/lib/roster/eventRosterService";

/** So viele Einträge kommen ohne weitere Angabe zurück */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

/**
 * Änderungsprotokoll eines Besetzungsplans.
 *
 * Absteigend nach Zeit, seitenweise über einen Cursor: Bei einem großen Event
 * kommen schnell einige hundert Einträge zusammen, und gebraucht wird fast
 * immer nur das Jüngste. Wer weiter zurück will, blättert nach.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  // Das Protokoll nennt interne Vorgänge und Namen – es bleibt dem Team
  // vorbehalten, das den Plan auch sonst einsehen darf.
  if (!(await canViewEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!roster) return NextResponse.json({ entries: [], actors: [] });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const before = Number(searchParams.get("before"));

  const rows = await prisma.eventRosterActivity.findMany({
    where: {
      rosterId: roster.id,
      ...(before && !isNaN(before) ? { id: { lt: before } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Namen der Bearbeitenden einmal auflösen – im Protokoll steht die CID, der
  // Name gehört in die Anzeige.
  const cids = [...new Set(page.map((r) => r.actorCID).filter((c): c is number => !!c))];
  const users = cids.length
    ? await prisma.user.findMany({
        where: { cid: { in: cids } },
        select: { cid: true, name: true },
      })
    : [];
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return NextResponse.json({
    entries: page.map((r) => ({
      id: r.id,
      action: r.action,
      summary: r.summary,
      stationCallsign: r.stationCallsign,
      targetCID: r.targetCID,
      actorCID: r.actorCID,
      actorName: r.actorCID ? nameByCid.get(r.actorCID) ?? null : null,
      createdAt: r.createdAt,
    })),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}
