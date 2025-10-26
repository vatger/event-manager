import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/getSessionUser";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const user = await getSessionUser();
  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    user?.role === "MAIN_ADMIN" || (await userHasPermission(Number(user!.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { name, description } = data;

  const group = await prisma.group.update({
    where: { id: Number(groupId) },
    data: { name, description },
  });

  return NextResponse.json(group);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const user = await getSessionUser();
  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    user?.role === "MAIN_ADMIN" || (await userHasPermission(Number(user!.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.group.delete({ where: { id: Number(groupId) } });
  return NextResponse.json({ success: true });
}
