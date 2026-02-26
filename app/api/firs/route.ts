import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/getSessionUser";
import { getUserWithPermissions } from "@/lib/acl/permissions";
import { CurrentUser } from "@/types/fir";

const firSchema = z.object({
  code: z.string().length(4, "FIR Code must be 4 letters"),
  name: z.string().min(3),
});
/**
 * GET /api/firs
 * Gibt alle FIRs inkl. Gruppen, Mitglieder & Berechtigungen zurück.
 * Zugriff nur für MAINADMIN, VATGER_LEITUNG oder FIR_LEITUNG (eigene FIR).
 */
export async function GET() {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = (await getUserWithPermissions(
    Number(sessionUser.cid)
  )) as CurrentUser | null;
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isGlobal =
    user.effectiveLevel === "MAIN_ADMIN" ||
    user.effectiveLevel === "VATGER_LEITUNG";
  const canManageOwnFIR =
    !!user.fir?.code &&
    user.effectiveLevel === "FIR_EVENTLEITER";
  
  if (!isGlobal && !canManageOwnFIR) {
    return NextResponse.json(
      { error: "Forbidden", level: user.effectiveLevel },
      { status: 403 }
    );
  }
  
  // MainAdmin / VATGER-Leitung → alle FIRs
  // FIR-Leitung → nur eigene FIR
  const firFilter = isGlobal
    ? {}
    : { id: user.fir?.id ?? -1 }; // eigene FIR oder nichts
  
  const firs = await prisma.fIR.findMany({
    where: firFilter,
    include: {
      groups: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  cid: true,
                  name: true,
                  rating: true,
                },
              },
            },
          },
          permissions: {
            include: {
              permission: {
                select: {
                  key: true,
                  description: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  // Daten etwas aufbereiten (flacher, lesbarer fürs Frontend)
  const response = firs.map((fir) => ({
    id: fir.id,
    code: fir.code,
    name: fir.name,
    groups: fir.groups.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      description: g.description,
      members: g.members.map((m) => ({
        id: m.user.id,
        cid: m.user.cid,
        name: m.user.name,
        rating: m.user.rating,
      })),
      permissions: g.permissions.map((p) => ({
        key: p.permission.key,
        description: p.permission.description,
        scope: p.scope,
      })),
    })),
  }));
  return NextResponse.json(response);
}
