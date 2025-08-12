import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const signup = await prisma.eventSignup.findUnique({
    where: { id: Number(params.id) },
    include: { event: true, user: true }
  });
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(signup);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  const data = await req.json();
  const s = await prisma.eventSignup.findUnique({
    where: { id: Number(params.id) },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const signup = await prisma.eventSignup.update({
    where: { id: Number(params.id) },
    data
  });
  return NextResponse.json(signup);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  const s = await prisma.eventSignup.findUnique({
    where: { id: Number(params.id) },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  await prisma.eventSignup.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
