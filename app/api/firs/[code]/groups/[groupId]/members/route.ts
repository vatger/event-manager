import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { z } from "zod";
import { canManageFir } from "@/lib/acl/permissions";

// ✅ Eingabe-Validierung
const addSchema = z.object({ cid: z.number() });

// ───────────────────────────── GET ─────────────────────────────
export async function GET(
  _: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: Number(groupId) },
    select: { id: true, kind: true, firId: true },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const allowed = await canManageFir(Number(user.cid), fir.code)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.userGroup.findMany({
    where: { groupId: Number(groupId) },
    include: { user: true },
  });
  return NextResponse.json(members);
}

// ───────────────────────────── POST ─────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: Number(groupId) },
    select: { id: true, kind: true, firId: true },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const allowed = await canManageFir(Number(user.cid), fir.code)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const targetUser = await prisma.user.findUnique({
    where: { cid: parsed.data.cid },
  });
  if (!targetUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // falls FIR-gebunden → User der FIR zuordnen
  if (group.firId) {
    if(targetUser.firId && targetUser.firId !== group.firId) {
      return NextResponse.json({ error: "User belongs to another FIR" }, { status: 409 });
    }
    await prisma.user.update({
      where: { cid: targetUser.cid },
      data: { firId: group.firId },
    });
  }

  const existing = await prisma.userGroup.findFirst({
    where: { userCID: targetUser.cid, groupId: Number(groupId) },
  });
  if (existing)
    return NextResponse.json({ error: "Already member" }, { status: 409 });

  const newMember = await prisma.userGroup.create({
    data: { userCID: targetUser.cid, groupId: Number(groupId) },
    include: { user: true },
  });

  //Cache invalidieren

  return NextResponse.json(newMember, { status: 201 });
}

// ───────────────────────────── DELETE ─────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: Number(groupId) },
    select: { id: true, kind: true, firId: true },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const cid = Number(searchParams.get("cid"));
  if (!cid) return NextResponse.json({ error: "CID required" }, { status: 400 });

  const allowed = await canManageFir(Number(user.cid), fir.code)

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { cid: cid }, include: { groups: true } });
  if (!target)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.userGroup.deleteMany({
    where: { userCID: target.cid, groupId: Number(groupId) },
  });

  if(target.groups.length === 1 && group.firId) {
    // Der User war nur in dieser Gruppe → FIR-Zuordnung entfernen
    await prisma.user.update({
      where: { cid: target.cid },
      data: { firId: null },
    });
  }
  
  return NextResponse.json({ success: true });
}
