import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { userhasPermissiononEvent } from '@/lib/acl/permissions';

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  const { eventId } = await params;
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!await userhasPermissiononEvent(Number(session.user.cid), Number(eventId), "user.notif")) {
    return NextResponse.json({ error: "Insufficient permissions", message: "You need user.notif in your FIR to notify users" }, { status: 403 });
  }

  const id = parseInt(eventId);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid Event ID" }, { status: 400 });
  }

  try {
    const { userCID, customMessage, customTitle } = await req.json();

    if (!userCID || !customMessage) {
      return NextResponse.json(
        { error: "userCID and customMessage are required" }, 
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({ 
      where: { id } 
    });
    
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const signup = await prisma.eventSignup.findFirst({
      where: { 
        eventId: id,
        user: { cid: Number(userCID) }
      },
      include: { user: true }
    });

    if (!signup) {
      return NextResponse.json(
        { error: "User is not signed up for this event" }, 
        { status: 404 }
      );
    }

    const title = customTitle || `Update - ${event.name}`;
    const message = customMessage;

    // Lokale Notification speichern
    await prisma.notification.create({
      data: {
        userCID: signup.user.cid,
        eventId: id,
        type: "EVENT",
        title,
        message,
      },
    });

    const isEmailNotifEnabled = signup.user.emailNotificationsEnabled ?? false;
    const body = {
      title,
      message: `[${event.name}] ${message}`,
      source_name: "Eventsystem",
      link_text: "Jetzt ansehen",
      link_url: `${process.env.NEXTAUTH_URL}/events/${event.id}`,
      ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
    };

    // VATGER-API aufrufen
    try {
      await fetch(`${process.env.VATGER_API}/${signup.user.cid}/send_notification`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.VATGER_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (apiError) {
      console.error("VATGER API Error:", apiError);
      // Weiter auch bei API-Fehlern
    }

    return NextResponse.json({
      success: true,
      message: `Benachrichtigung an User ${signup.user.cid} gesendet`,
      user: {
        cid: signup.user.cid,
        name: signup.user.name
      }
    });

  } catch (error) {
    console.error("Error sending individual notification:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}