import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AUTH_TOKEN = process.env.ADMIN_API_TOKEN;

// Middleware: Token-Prüfung
function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization");
  if (!token || token !== `Bearer ${AUTH_TOKEN}`) {
    return false;
  }
  return true;
}

// GET /api/users/[cid]
export async function GET(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cid = parseInt((await params).cid);
  
  if (isNaN(cid)) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { cid },
    include: {
      signups: {
        include: {
          event: {select: { id: true, name: true, startTime: true, endTime: true }},
        },
      },
      Notification: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user, { status: 200 });
}

// DELETE /api/users/[cid]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cid = parseInt((await params).cid);
  if (isNaN(cid)) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 200 });
  }

  const existingUser = await prisma.user.findUnique({ where: { cid } });
  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 200 });
  }

  // Zuerst abhängige Einträge löschen (wegen Foreign Keys)
  await prisma.eventSignup.deleteMany({
    where: { userCID: cid },
  });

  await prisma.notification.deleteMany({
    where: { userCID: cid },
  });

  await prisma.user.delete({
    where: { cid },
  });

  return NextResponse.json({ message: "User and related data deleted successfully" }, { status: 200 });
}
