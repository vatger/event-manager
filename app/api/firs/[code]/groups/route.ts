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
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    user?.role === "MAIN_ADMIN" || (await userHasPermission(Number(user!.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const groups = await prisma.group.findMany({
    where: { firId: fir.id },
    include: {
      members: { include: { user: true } },
      permissions: { include: { permission: true } },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  const { code } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    user?.role === "MAIN_ADMIN" || (await userHasPermission(Number(user!.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { name, description } = data;

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const group = await prisma.group.create({
    data: {
      name,
      description,
      firId: fir.id,
    },
  });

  return NextResponse.json(group);
}
