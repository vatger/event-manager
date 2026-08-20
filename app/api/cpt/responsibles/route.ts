import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { hasAdminAccess } from "@/lib/acl/permissions";
import { canManageCptResponsibles } from "@/lib/cpt/cptService";
import { CPT_FIR_CODES } from "@/config/cptFirMapping";

const firSchema = z.enum(CPT_FIR_CODES);
const postSchema = z.object({
  firCode: firSchema,
  userCID: z.number().int().positive(),
});

/** Liste der CPT-Verantwortlichen – optional auf eine FIR eingegrenzt. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cid = Number(user.cid);
  if (!(await hasAdminAccess(cid))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const firParam = req.nextUrl.searchParams.get("fir")?.toUpperCase();
  const rows = await prisma.cptResponsible.findMany({
    where: firParam ? { firCode: firParam } : undefined,
    include: { user: { select: { cid: true, name: true, rating: true } } },
    orderBy: [{ firCode: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    responsibles: rows.map((r) => ({
      firCode: r.firCode,
      userCID: r.userCID,
      name: r.user?.name ?? `CID ${r.userCID}`,
      rating: r.user?.rating ?? null,
      addedByCID: r.addedByCID,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/** Trägt einen Nutzer als CPT-Verantwortlichen einer FIR ein. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const cid = Number(user.cid);
  const { firCode, userCID } = parsed.data;

  if (!(await canManageCptResponsibles(cid, firCode))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { cid: userCID },
    select: { cid: true, name: true, rating: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Nutzer mit dieser CID nicht gefunden" },
      { status: 404 }
    );
  }

  const fir = await prisma.fIR.findUnique({ where: { code: firCode } });
  if (!fir) {
    return NextResponse.json({ error: "FIR nicht gefunden" }, { status: 404 });
  }

  await prisma.cptResponsible.upsert({
    where: { firCode_userCID: { firCode, userCID } },
    create: { firCode, userCID, addedByCID: cid },
    update: {},
  });

  return NextResponse.json(
    {
      success: true,
      responsible: {
        firCode,
        userCID: target.cid,
        name: target.name,
        rating: target.rating,
      },
    },
    { status: 201 }
  );
}
