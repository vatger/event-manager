import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canManageFir, isVatgerEventleitung } from "@/lib/acl/permissions";

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

  const hasAccess = await canManageFir(Number(user!.cid), fir.code);
  if (!hasAccess)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(fir);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  if (!user || await isVatgerEventleitung(Number(user.cid)))
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
  if (!user || await isVatgerEventleitung(Number(user.cid)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { code } = await params;
  await prisma.fIR.delete({ where: { code } });
  return NextResponse.json({ success: true });
}
