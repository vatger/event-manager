// app/api/firs/[code]/groups/[groupId]/permissions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";
import { clearCache } from "@/lib/cache";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string; groupId: string }> }) {
  const {code, groupId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fir = await prisma.fIR.findUnique({ where: { code: code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const hasAccess =
    session.user.role === "MAIN_ADMIN" ||
    (await userHasPermission(Number(session.user.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allPerms = await prisma.permission.findMany({
    include: { groups: { where: { groupId: Number(groupId) } } },
    orderBy: { key: "asc" },
  });

  const formatted = allPerms.map((p) => ({
    id: p.id,
    key: p.key,
    description: p.description,
    assignedScope: p.groups[0]?.scope ?? null,
  }));
  return NextResponse.json(formatted);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string; groupId: string }> }) {
    const { code, groupId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fir = await prisma.fIR.findUnique({ where: { code: code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const isMainAdmin = session.user.role === "MAIN_ADMIN";
  const hasAccess =
    isMainAdmin ||
    (await userHasPermission(Number(session.user.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates = await req.json(); // [{ permissionId, scope|null }]
  if (!Array.isArray(updates)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const gId = Number(groupId);

  // Entferne alles, legen dann gemäß Liste neu an
  await prisma.groupPermission.deleteMany({ where: { groupId: gId } });

  for (const up of updates) {
    if (!up?.scope) continue;
    if (up.scope === "ALL" && !isMainAdmin) {
      return NextResponse.json({ error: "Insufficient permissions for ALL scope" }, { status: 403 });
    }
    await prisma.groupPermission.create({
      data: { groupId: gId, permissionId: Number(up.permissionId), scope: up.scope },
    });
  }
  clearCache()
  return NextResponse.json({ success: true });
}
