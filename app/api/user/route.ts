import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const data = await req.json();
  const user = await prisma.user.create({ data });
  return NextResponse.json(user, { status: 201 });
}
