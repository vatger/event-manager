import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const {id} = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cid = parseInt(session.user.cid);

  try {
    const ID = parseInt(id);
    const updated = await prisma.notification.update({
      where: { id: ID },
      data: { readAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}