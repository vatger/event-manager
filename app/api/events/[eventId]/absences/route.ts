import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageEventSignups, canViewEventRoster } from "@/lib/roster/rosterPermissions";

/**
 * GET /api/events/[eventId]/absences – wer sich als „nicht dabei“ gemeldet
 * hat. Nur für das Eventteam (Anmeldungen verwalten oder Plan einsehen).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getSessionUser();
  if (!user?.cid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cid = Number(user.cid);

  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }
  if (!(await canManageEventSignups(cid, id)) && !(await canViewEventRoster(cid, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const absences = await prisma.eventAbsence.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "desc" },
    select: {
      reason: true,
      createdAt: true,
      user: { select: { cid: true, name: true, rating: true } },
    },
  });
  return NextResponse.json({
    absences: absences.map((a) => ({
      cid: a.user.cid,
      name: a.user.name,
      rating: a.user.rating,
      reason: a.reason,
      since: a.createdAt,
    })),
  });
}
