import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: Number(params.id) },
    include: { signups: true, documents: true }
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  const data = await req.json();
  const event = await prisma.event.update({
    where: { id: Number(params.id) },
    data
  });
  return NextResponse.json(event);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await prisma.event.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
