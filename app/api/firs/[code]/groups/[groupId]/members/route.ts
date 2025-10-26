import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/getSessionUser";

export async function GET(
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

  const members = await prisma.userGroup.findMany({
    where: { groupId: Number(groupId) },
    include: { user: true },
  });

  return NextResponse.json(members);
}

export async function POST(
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

  const { cid } = await req.json();
  if (!cid) return NextResponse.json({ error: "CID required" }, { status: 400 });

  const targetUser = await prisma.user.findUnique({ where: { cid } });
  if (!targetUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const exists = await prisma.userGroup.findFirst({
    where: { userCID: cid, groupId: Number(groupId) },
  });
  if (exists) return NextResponse.json({ error: "Already member" }, { status: 409 });

  const ug = await prisma.userGroup.create({
    data: { userCID: cid, groupId: Number(groupId) },
  });

  return NextResponse.json(ug);
}

export async function DELETE(
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

  const { searchParams } = new URL(req.url);
  const cid = Number(searchParams.get("cid"));
  if (!cid) return NextResponse.json({ error: "CID required" }, { status: 400 });

  await prisma.userGroup.deleteMany({
    where: { userCID: cid, groupId: Number(groupId) },
  });

  return NextResponse.json({ success: true });
}
