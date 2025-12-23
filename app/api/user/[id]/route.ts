import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const {id} = await params
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const {id} = await params
  const data = await req.json();
  const user = await prisma.user.update({
    where: { id: Number(id) },
    data
  });
  return NextResponse.json(user);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const {id} = await params
  await prisma.user.delete({ where: { id: Number(id) } });
  return NextResponse.json({ success: true });
}
