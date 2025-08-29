import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, title, message, data, type = "EVENT" } = await req.json();
  if (!eventId || !title || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const signups = await prisma.eventSignup.findMany({ where: { eventId: Number(eventId) }, select: { userCID: true } });
  if (signups.length === 0) return NextResponse.json({ success: true, created: 0 });

  const created = await prisma.$transaction(
    signups.map((s) =>
      prisma.notification.create({
        data: {
          userCID: s.userCID,
          eventId: Number(eventId),
          type,
          title,
          message,
          data,
        },
      })
    )
  );

  return NextResponse.json({ success: true, created: created.length });
}
