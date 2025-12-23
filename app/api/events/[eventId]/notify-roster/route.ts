import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userhasPermissiononEvent } from "@/lib/acl/permissions";

const VATGER_API_TOKEN = process.env.VATGER_API_TOKEN!;

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const session = await getServerSession(authOptions);
  const { eventId } = await params;
  // 🔒 Prüfen ob eingeloggt
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 🔒 Prüfen ob Admin oder Main Admin
  if (!await userhasPermissiononEvent(Number(session.user.cid), Number(eventId), "roster.publish")) {
    return NextResponse.json({ error: "Insufficient permissions", message: "You need roster.publish in your FIR to send this notification" }, { status: 403 });
  }

  const id = parseInt(eventId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid Event ID" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const signups = await prisma.eventSignup.findMany({
    where: { id },
    include: { user: true },
  });

  if (signups.length === 0) {
    return NextResponse.json({ message: "No users signed up for this event." }, { status: 200 });
  }

  const message = `Das Roster für ${event.name} wurde veröffentlicht! Schau gleich nach, auf welcher Position du eingeteilt bist.`;

  // Lokale Notification speichern
  await prisma.$transaction(
    signups.map((s) =>
      prisma!.notification.create({
        data: {
          userCID: s.user.cid,
          eventId: id,
          type: "EVENT",
          title: `Roster veröffentlicht`,
          message,
        },
      })
    )
  );

  // VATGER-API aufrufen
  const results = await Promise.allSettled(
    signups.map((s) => {
      const isEmailNotifEnabled = s.user.emailNotificationsEnabled ?? false;
      const body = {
        title: `Roster veröffentlicht – ${event.name}`,
        message,
        source_name: "Eventsystem",
        link_text: "Jetzt ansehen",
        link_url: `${process.env.NEXTAUTH_URL}/events/${event.id}`,
        ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
      };

      fetch(`${process.env.VATGER_API}/${s.user.cid}/send_notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${VATGER_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    })
  );

  const successCount = results.filter((r) => r.status === "fulfilled").length;

  return NextResponse.json({
    message: `Roster veröffentlicht – ${successCount} Benutzer wurden benachrichtigt.`,
  });
}
