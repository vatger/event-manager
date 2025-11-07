// app/api/user/notifications/email/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: aktueller Status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { cid: Number(session.user.id) },
    select: { emailNotificationsEnabled: true },
  });

  return NextResponse.json({ emailNotificationsEnabled: user?.emailNotificationsEnabled ?? false });
}

// POST: neuen Status setzen
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emailNotificationsEnabled } = await req.json();
  if (typeof emailNotificationsEnabled !== "boolean") {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  await prisma.user.update({
    where: { cid: Number(session.user.id) },
    data: { emailNotificationsEnabled },
  });

  return NextResponse.json({ success: true });
}
