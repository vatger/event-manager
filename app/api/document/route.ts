import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const docs = await prisma.eventDocument.findMany({ include: { event: true } });
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const data = await req.json();
  const doc = await prisma.eventDocument.create({ data });
  return NextResponse.json(doc, { status: 201 });
}
