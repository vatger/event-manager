import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { getEventCapabilities } from "@/lib/events/eventAccess";
import { ACTIVITY_CATEGORIES } from "@/lib/events/eventActivityFormat";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET /api/events/[eventId]/activity
 * Änderungsprotokoll der Event-Verwaltung, neueste zuerst, seitenweise über
 * `before` (ID des ältesten bereits geladenen Eintrags).
 * Filter: `category`, `actor` (CID).
 *
 * Sichtbar für das Eventdepartment der FIR des Events, die VATGER-Eventleitung
 * und die Verantwortlichen.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: "Ungültige Event-ID" }, { status: 400 });

  const capabilities = await getEventCapabilities(Number(user.cid), eventId);
  if (!capabilities) return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  if (!capabilities.viewLog) {
    return NextResponse.json(
      { error: "Das Protokoll sieht nur das Eventdepartment dieser FIR." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = Number(searchParams.get("before"));
  const category = searchParams.get("category");
  const actor = Number(searchParams.get("actor"));
  const validCategory = ACTIVITY_CATEGORIES.some((c) => c.id === category) ? category : null;

  const [rows, actorRows] = await Promise.all([
    prisma.eventActivity.findMany({
      where: {
        eventId,
        ...(before ? { id: { lt: before } } : {}),
        ...(validCategory ? { category: validCategory } : {}),
        ...(actor ? { actorCID: actor } : {}),
      },
      orderBy: { id: "desc" },
      take: limit + 1,
    }),
    prisma.eventActivity.findMany({
      where: { eventId, actorCID: { not: null } },
      distinct: ["actorCID"],
      select: { actorCID: true },
    }),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Namen beim Lesen auflösen: Im Protokoll steht die CID
  const cids = [...new Set([...page.map((r) => r.actorCID), ...actorRows.map((r) => r.actorCID)])].filter(
    (c): c is number => typeof c === "number"
  );
  const users = cids.length
    ? await prisma.user.findMany({ where: { cid: { in: cids } }, select: { cid: true, name: true } })
    : [];
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return NextResponse.json({
    entries: page.map((r) => ({
      id: r.id,
      category: r.category,
      action: r.action,
      summary: r.summary,
      details: r.details,
      actorCID: r.actorCID,
      actorName: r.actorCID ? nameByCid.get(r.actorCID) ?? null : null,
      createdAt: r.createdAt,
    })),
    actors: actorRows
      .map((r) => ({ cid: r.actorCID as number, name: nameByCid.get(r.actorCID as number) ?? null }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "de")),
    hasMore,
  });
}
