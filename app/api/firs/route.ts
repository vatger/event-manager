import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActor } from "@/lib/acl/teamService";
import { manageableDepartments } from "@/lib/acl/teamRules";
import type { DepartmentSummary } from "@/types/fir";

/**
 * GET /api/firs
 * Die Eventdepartments, die der Nutzer verwalten darf: alle für
 * VATGER-Eventleitung und Main-Admins, sonst die FIRs, deren Leitung er angehört.
 */
export async function GET() {
  const actor = await requireActor();
  if (actor instanceof NextResponse) return actor;

  const scope = manageableDepartments(actor);
  if (scope !== "ALL" && scope.length === 0) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const firs = await prisma.fIR.findMany({
    where: scope === "ALL" ? {} : { code: { in: scope } },
    include: {
      groups: {
        select: {
          kind: true,
          members: {
            select: { user: { select: { cid: true, name: true, rating: true } } },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const response: DepartmentSummary[] = firs.map((fir) => {
    const everyone = new Set(fir.groups.flatMap((g) => g.members.map((m) => m.user.cid)));
    return {
      code: fir.code,
      name: fir.name,
      groupCount: fir.groups.length,
      memberCount: everyone.size,
      leads: fir.groups
        .filter((g) => g.kind === "FIR_LEITUNG")
        .flatMap((g) => g.members.map((m) => m.user))
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    };
  });

  return NextResponse.json(response);
}
