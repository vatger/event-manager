import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/acl/teamService";
import { canViewVatgerLeitung } from "@/lib/acl/teamRules";
import { getMainAdminCids, isMainAdminCid } from "@/lib/acl/mainAdmins";
import type { MainAdmin, VatgerLeader } from "@/types/fir";

/**
 * GET /api/admin/vatger-leaders
 * Die VATGER-Eventleitung und die Main-Admins (aus MAIN_ADMIN_CIDS).
 * Sichtbar für VATGER-Eventleitung und Main-Admins; ändern darf nur ein Main-Admin.
 */
export async function GET() {
  const actor = await requireActor();
  if (actor instanceof NextResponse) return actor;
  if (!canViewVatgerLeitung(actor)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const mainAdminCids = getMainAdminCids();
  const [leaderRows, adminUsers] = await Promise.all([
    prisma.vATGERLeitung.findMany({
      select: { user: { select: { cid: true, name: true, rating: true } } },
    }),
    prisma.user.findMany({
      where: { cid: { in: mainAdminCids } },
      select: { cid: true, name: true, rating: true },
    }),
  ]);

  const leaders: VatgerLeader[] = leaderRows
    .map((row) => ({ ...row.user, isMainAdmin: isMainAdminCid(row.user.cid) }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  // Reihenfolge der Umgebungsvariable beibehalten; CIDs ohne Konto mit anzeigen
  const mainAdmins: MainAdmin[] = mainAdminCids.map((cid) => {
    const user = adminUsers.find((u) => u.cid === cid);
    return { cid, name: user?.name ?? null, rating: user?.rating ?? null };
  });

  return NextResponse.json({ leaders, mainAdmins });
}
