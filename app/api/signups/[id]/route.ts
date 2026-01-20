import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/lib/getSessionUser";
import { getUserWithPermissions, isVatgerEventleitung, userHasFirPermission } from "@/lib/acl/permissions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { id } = await params;
  const signup = await prisma.eventSignup.findUnique({
    where: { id: Number(id) },
    include: { event: true, user: true }
  });
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(signup);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const {id} = await params
  const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  const data = await req.json();
  const s = await prisma.eventSignup.findUnique({
    where: { id: Number(id) },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const signup = await prisma.eventSignup.update({
    where: { id: Number(id) },
    data
  });
  return NextResponse.json(signup);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const {id} = await params;
  const session = await getServerSession(authOptions);
  const user = await getUserWithPermissions(Number(session?.user?.cid));
  const fir = user?.fir;
  if(!fir || !user) return NextResponse.json({ error: "Unauthorized", message: "User belongs to no FIR" }, { status: 401 });
  if (await userHasFirPermission(user.cid, fir, "signups.manage") === false && await isVatgerEventleitung(user.cid) === false) {
    return NextResponse.json({ error: "Unauthorized", message: "You have no permission to create events (in this FIR)" }, { status: 401 });
  }
  
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  const s = await prisma.eventSignup.findUnique({
    where: { id: Number(id) },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  await prisma.eventSignup.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
