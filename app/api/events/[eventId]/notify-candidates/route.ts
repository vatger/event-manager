import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { userhasPermissiononEvent } from '@/lib/acl/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const session = await getServerSession(authOptions);
  const { eventId: eventIdParam } = await params;
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const eventId = parseInt(eventIdParam);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid Event ID" }, { status: 400 });
  }

  if (!await userhasPermissiononEvent(Number(session.user.cid), eventId, "user.notif")) {
    return NextResponse.json({ error: "Insufficient permissions", message: "You need user.notif in your FIR to notify candidates" }, { status: 403 });
  }

  try {
    const { userCIDs, customMessage, customTitle } = await req.json();

    if (!userCIDs || !Array.isArray(userCIDs) || userCIDs.length === 0 || !customMessage) {
      return NextResponse.json(
        { error: "userCIDs (array) and customMessage are required" }, 
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({ 
      where: { id: eventId } 
    });
    
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get users from the provided CIDs
    const users = await prisma.user.findMany({
      where: { 
        cid: { in: userCIDs.map(Number) }
      }
    });

    if (users.length === 0) {
      return NextResponse.json(
        { error: "No valid users found" }, 
        { status: 404 }
      );
    }

    const title = customTitle || `Unterstützung gesucht - ${event.name}`;
    const message = customMessage;

    // Create internal notifications for all users
    await prisma.$transaction(
      users.map((user) =>
        prisma!.notification.create({
          data: {
            userCID: user.cid,
            eventId,
            type: "EVENT",
            title,
            message,
          },
        })
      )
    );

    // Send external notifications via VATGER API
    const results = await Promise.allSettled(
      users.map((user) => {
        const isEmailNotifEnabled = user.emailNotificationsEnabled ?? false;
        const body = {
          title,
          message: `[${event.name}] ${message}`,
          source_name: "Eventsystem",
          link_text: "Jetzt anmelden",
          link_url: `${process.env.NEXTAUTH_URL}/events/${event.id}`,
          ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
        };
        return fetch(`${process.env.VATGER_API}/${user.cid}/send_notification`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.VATGER_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      message: `Benachrichtigungen an ${successful} potentielle Lotsen gesendet`,
      stats: {
        total: users.length,
        successful,
        failed
      }
    });

  } catch (error) {
    console.error("Error sending candidate notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
