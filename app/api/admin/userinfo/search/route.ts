import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { hasAdminAccess } from "@/lib/acl/permissions";

/** Mehr Vorschläge liest niemand – wer so viele Treffer hat, tippt weiter */
const LIMIT = 15;

/**
 * Personensuche für die Controllerinfo – nach Name oder CID.
 *
 * Dieselbe Berechtigung wie die Controllerinfo selbst: Wer die Daten einer
 * Person ansehen darf, soll sie auch finden können, ohne vorher anderswo ihre
 * CID nachzuschlagen.
 *
 * Mehrere Wörter müssen alle vorkommen, in beliebiger Reihenfolge – „Meier
 * Leon" findet also auch „Leon Meierding". Groß- und Kleinschreibung spielen
 * keine Rolle (Sortierfolge der Datenbank).
 *
 * Gefunden wird nur, wer sich schon einmal am Eventmanager angemeldet hat;
 * nach anderen lässt sich weiterhin direkt per CID suchen.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasAdminAccess(Number(user.cid)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const numeric = /^\d+$/.test(q);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { AND: words.map((w) => ({ name: { contains: w } })) },
        // Eine vollständige CID trifft auch dann, wenn der Name nicht passt
        ...(numeric ? [{ cid: Number(q) }] : []),
      ],
    },
    select: { cid: true, name: true, rating: true },
    orderBy: { name: "asc" },
    take: LIMIT,
  });

  // Eine exakt passende CID gehört nach oben, egal wie der Name lautet.
  users.sort((a, b) => Number(b.cid === Number(q)) - Number(a.cid === Number(q)));

  return NextResponse.json({ users });
}
