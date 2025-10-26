import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/getSessionUser";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  const { code } = await params;
  const fir = await prisma.fIR.findUnique({
    where: { code },
    include: { groups: true },
  });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const hasAccess =
    user?.role === "MAIN_ADMIN" || (await userHasPermission(Number(user!.cid), "fir.manage", fir.id));
  if (!hasAccess)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(fir);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "MAIN_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { name } = data;

  const { code } = await params;
  const fir = await prisma.fIR.update({
    where: { code },
    data: { name },
  });
  return NextResponse.json(fir);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "MAIN_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await params;
  await prisma.fIR.delete({ where: { code } });
  return NextResponse.json({ success: true });
}
