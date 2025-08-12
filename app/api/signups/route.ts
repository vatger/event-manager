import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const signups = await prisma.eventSignup.findMany({
    include: { event: true, user: true }
  });
  return NextResponse.json(signups);
}

export async function POST(req: Request) {
  const data = await req.json();
  const signup = await prisma.eventSignup.create({ data });
  return NextResponse.json(signup, { status: 201 });
}
