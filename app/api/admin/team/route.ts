import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isMainAdmin } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session || 
    (session.user.role !== "ADMIN" && session.user.role !== "MAIN_ADMIN")
  ) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MAIN_ADMIN"] } },
    select: { id: true, name: true, role: true, cid: true, rating: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await prisma.user.findUnique({ where: { cid: Number(session.user.id) } });
  if (!currentUser || !isMainAdmin(currentUser)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cid } = await req.json();
  if (!cid) return NextResponse.json({ error: "CID required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { cid: Number(cid) } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { cid: Number(cid) },
    data: { role: "ADMIN" },
  });

  return NextResponse.json(updated);
}
