import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/acl/teamService";
import { canAccessTeamArea } from "@/lib/acl/teamRules";
import type { TeamUserSearchResult } from "@/types/fir";

/**
 * GET /api/team/user-search?q=…
 * Personensuche nach Name oder CID für den Bereich „Team & Rechte“. Liefert
 * mit, welchem Eventdepartment die Person bereits angehört. Gefunden wird nur,
 * wer sich schon einmal im Eventmanager angemeldet hat.
 */
export async function GET(req: Request) {
  const actor = await requireActor();
  if (actor instanceof NextResponse) return actor;
  if (!canAccessTeamArea(actor)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const query = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json([]);

  const isNumeric = /^\d+$/.test(query);
  const users = await prisma.user.findMany({
    where: isNumeric
      ? { OR: [{ cid: Number(query) }, { name: { contains: query } }] }
      : { name: { contains: query } },
    select: { cid: true, name: true, rating: true, fir: { select: { code: true } } },
    orderBy: { name: "asc" },
    take: 8,
  });

  const response: TeamUserSearchResult[] = users.map((u) => ({
    cid: u.cid,
    name: u.name,
    rating: u.rating,
    firCode: u.fir?.code ?? null,
  }));
  return NextResponse.json(response);
}
