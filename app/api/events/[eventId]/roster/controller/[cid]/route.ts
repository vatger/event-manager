import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  canViewEventRoster,
} from "@/lib/roster/eventRosterService";
import { getUserATCStats, getTopStations } from "@/lib/weeklys/atcSessionStats";

// GET: Detailinfos zu einem Controller im Roster-Kontext:
// ATC-Statistiken (Top-Stationen) + interne RMKs (UserComments)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; cid: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam, cid: cidParam } = await params;
  const eventId = Number(idParam);
  const cid = Number(cidParam);
  if (isNaN(eventId) || isNaN(cid)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!(await canViewEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Interne RMKs (persistente UserComments) laden
  const comments = await prisma.userComment.findMany({
    where: { userCID: cid },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { cid: true, name: true } } },
  });

  // ATC-Statistiken laden (externe API – bei Fehler leer).
  // Alle Stationen mitgeben, damit im Editor über sie gesucht werden kann;
  // die Liste ist pro Nutzer klein genug.
  let atcStations: ReturnType<typeof getTopStations> = [];
  let statsError = false;
  try {
    const stats = await getUserATCStats(cid);
    atcStations = getTopStations(stats);
  } catch (err) {
    console.error("[ROSTER] ATC-Stats für", cid, "fehlgeschlagen:", err);
    statsError = true;
  }
  const atcTotalMinutes = atcStations.reduce((sum, s) => sum + s.totalMinutes, 0);

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      comment: c.comment,
      authorName: c.author?.name ?? null,
      createdAt: c.createdAt,
    })),
    atcStations,
    atcTotalMinutes,
    statsError,
  });
}

const postSchema = z.object({ comment: z.string().min(1).max(2000) });

// POST: Persistente interne RMK (UserComment) hinzufügen
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; cid: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam, cid: cidParam } = await params;
  const eventId = Number(idParam);
  const cid = Number(cidParam);
  if (isNaN(eventId) || isNaN(cid)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Kommentartext erforderlich" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { cid }, select: { cid: true } });
  if (!target) return NextResponse.json({ error: "Nutzer nicht gefunden" }, { status: 404 });

  const created = await prisma.userComment.create({
    data: { userCID: cid, authorCID: Number(user.cid), comment: parsed.data.comment.trim() },
    include: { author: { select: { cid: true, name: true } } },
  });

  return NextResponse.json({
    comment: {
      id: created.id,
      comment: created.comment,
      authorName: created.author?.name ?? null,
      createdAt: created.createdAt,
    },
  }, { status: 201 });
}
