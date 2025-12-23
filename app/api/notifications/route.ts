import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cid = parseInt(session.user.id);

  const notifications = await prisma.notification.findMany({
    where: { userCID: cid },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      event: {
        select: { 
          name: true,
          status: true,
          startTime: true
        }
      }
    }
  });

  return NextResponse.json(notifications);
}
