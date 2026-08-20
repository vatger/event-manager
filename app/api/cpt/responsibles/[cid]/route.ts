import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageCptResponsibles } from "@/lib/cpt/cptService";

/** Entfernt einen CPT-Verantwortlichen aus einer FIR (`?fir=EDMM`). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cid: cidParam } = await params;
  const targetCID = Number(cidParam);
  const firCode = req.nextUrl.searchParams.get("fir")?.toUpperCase();

  if (!Number.isInteger(targetCID) || !firCode) {
    return NextResponse.json({ error: "CID und FIR erforderlich" }, { status: 400 });
  }

  if (!(await canManageCptResponsibles(Number(user.cid), firCode))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.cptResponsible.deleteMany({ where: { firCode, userCID: targetCID } });
  return NextResponse.json({ success: true });
}
