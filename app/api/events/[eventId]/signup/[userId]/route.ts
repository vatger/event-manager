import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { userhasPermissiononEvent } from "@/lib/acl/permissions";
import { invalidateSignupTable } from "@/lib/cache/signupTableCache";
import { getSessionUser } from "@/lib/getSessionUser";



// GET: einzelnes Signup holen
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string, userId: string }> }) {
  const user = await getSessionUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId, userId } = await params;

  try {
    const signup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userCID: {
          eventId: parseInt(eventId, 10),
          userCID: parseInt(userId, 10),
        },
      },
    });

    if (!signup) {
      return NextResponse.json({ error: "Signup nicht gefunden" }, { status: 404 });
    }
    
    // If soft-deleted, treat as not found for non-signed-up status
    // But still return the data so users can restore it
    return NextResponse.json(signup);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Abrufen" }, { status: 500 });
  }
}

// PUT: Signup aktualisieren
export async function PUT(req: Request, { params }: { params: Promise<{ eventId: string, userId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId, userId } = await params;
  const body = await req.json();
  const session = await getServerSession(authOptions);
  const eventdata = await prisma.event.findUnique({where: {id: Number(eventId)}})
  if (!eventdata) return NextResponse.json({error: "Das Event existiert nicht mehr"}, {status: 500})
  if(!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const hasManagePermission = await userhasPermissiononEvent(Number(session.user.cid), Number(eventId), "signups.manage");
  
  // Allow changes even when SIGNUP_CLOSED (will be tracked if after deadline)
  // Only block if event is in certain states AND user is not event team
  if(!hasManagePermission && !["SIGNUP_OPEN", "SIGNUP_CLOSED"].includes(eventdata.status))
    return NextResponse.json({error: "Die Anmeldung dieses Events ist geschlossen - Bitte wende dich an das Eventteam"}, {status: 500}) 

  try {
    // Get current signup to track changes
    const currentSignup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userCID: {
          eventId: parseInt(eventId, 10),
          userCID: parseInt(userId, 10),
        },
      },
    });

    if (!currentSignup) {
      return NextResponse.json({ error: "Signup nicht gefunden" }, { status: 404 });
    }

    // Check if this is a restore operation
    if (body.restore) {
      // Regular users can restore only when SIGNUP_OPEN
      // Event team can restore anytime
      const canRestore = hasManagePermission || eventdata.status === "SIGNUP_OPEN";
      
      if (!canRestore) {
        return NextResponse.json({ 
          error: "Wiederherstellen ist nur bei offener Anmeldung oder mit entsprechenden Rechten möglich" 
        }, { status: 403 });
      }
      
      const updated = await prisma.eventSignup.update({
        where: {
          eventId_userCID: {
            eventId: parseInt(eventId, 10),
            userCID: parseInt(userId, 10),
          },
        },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });
      await invalidateSignupTable(Number(eventId))
      return NextResponse.json(updated);
    }

    // Check if this is an acknowledge changes operation (event team only)
    if (body.acknowledgeChanges) {
      if (!hasManagePermission) {
        return NextResponse.json({ 
          error: "Keine Berechtigung zum Bestätigen von Änderungen" 
        }, { status: 403 });
      }
      
      const updated = await prisma.eventSignup.update({
        where: {
          eventId_userCID: {
            eventId: parseInt(eventId, 10),
            userCID: parseInt(userId, 10),
          },
        },
        data: {
          changesAcknowledged: true,
          changeLog: [],
        },
      });
      await invalidateSignupTable(Number(eventId))
      return NextResponse.json(updated);
    }

    // Check if modification is after deadline
    const isAfterDeadline = eventdata.signupDeadline && new Date() > new Date(eventdata.signupDeadline);
    
    // Track changes if after deadline
    let changeLog = currentSignup.changeLog ? (Array.isArray(currentSignup.changeLog) ? currentSignup.changeLog : []) : [];
    
    if (isAfterDeadline && !hasManagePermission) {
      const changes: Array<{
        field: string;
        oldValue: unknown;
        newValue: unknown;
        changedAt: string;
        changedBy: number;
      }> = [];
      
      // Track availability changes
      if (JSON.stringify(currentSignup.availability) !== JSON.stringify(body.availability)) {
        changes.push({
          field: 'availability',
          oldValue: currentSignup.availability,
          newValue: body.availability,
          changedAt: new Date().toISOString(),
          changedBy: Number(session.user.cid)
        });
      }
      
      // Track preferredStations changes
      if (currentSignup.preferredStations !== body.preferredStations) {
        changes.push({
          field: 'preferredStations',
          oldValue: currentSignup.preferredStations,
          newValue: body.preferredStations,
          changedAt: new Date().toISOString(),
          changedBy: Number(session.user.cid)
        });
      }
      
      // Track remarks changes
      if (currentSignup.remarks !== body.remarks) {
        changes.push({
          field: 'remarks',
          oldValue: currentSignup.remarks,
          newValue: body.remarks,
          changedAt: new Date().toISOString(),
          changedBy: Number(session.user.cid)
        });
      }
      
      // Track excludedAirports changes
      if (JSON.stringify(currentSignup.excludedAirports) !== JSON.stringify(body.excludedAirports)) {
        changes.push({
          field: 'excludedAirports',
          oldValue: currentSignup.excludedAirports,
          newValue: body.excludedAirports,
          changedAt: new Date().toISOString(),
          changedBy: Number(session.user.cid)
        });
      }
      
      if (changes.length > 0) {
        changeLog = [...(changeLog as unknown[]), ...changes] as typeof changeLog;
        
        // Send notification to event team
        await sendChangeNotificationToEventTeam(
          parseInt(eventId, 10),
          currentSignup.userCID,
          session.user.name || 'Unknown',
          changes,
          eventdata.firCode
        );
      }
    }

    const updated = await prisma.eventSignup.update({
      where: {
        eventId_userCID: {
          eventId: parseInt(eventId, 10),
          userCID: parseInt(userId, 10),
        },
      },
      data: {
        availability: body.availability,
        breakrequests: body.breakrequests,
        preferredStations: body.preferredStations,
        remarks: body.remarks,
        excludedAirports: body.excludedAirports,
        modifiedAfterDeadline: isAfterDeadline || currentSignup.modifiedAfterDeadline,
        changeLog: changeLog.length > 0 ? JSON.parse(JSON.stringify(changeLog)) : currentSignup.changeLog,
        // Reset acknowledged flag if new changes were made after deadline
        changesAcknowledged: (isAfterDeadline && changeLog.length > (Array.isArray(currentSignup.changeLog) ? currentSignup.changeLog.length : 0)) ? false : currentSignup.changesAcknowledged,
      },
    });
    await invalidateSignupTable(Number(eventId))
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Updaten" }, { status: 500 });
  }
}

// DELETE: Signup löschen (soft delete for users, hard delete for event team)
export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string, userId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId, userId } = await params;
  const session = await getServerSession(authOptions);
  const eventdata = await prisma.event.findUnique({where: {id: Number(eventId)}})
  if (!eventdata) return NextResponse.json({error: "Das Event existiert nicht mehr"}, {status: 500})
  if(!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const hasManagePermission = await userhasPermissiononEvent(Number(session.user.cid), Number(eventId), "signups.manage");
  
  // Check if requesting hard delete (query parameter)
  const url = new URL(req.url);
  const hardDelete = url.searchParams.get('hard') === 'true';
  
  // Only event team can do hard delete
  if (hardDelete && !hasManagePermission) {
    return NextResponse.json({ error: "Keine Berechtigung für Hard Delete" }, { status: 403 });
  }
  
  // Allow soft delete even when SIGNUP_CLOSED
  // Only block if event is in certain states AND user is not event team
  if(!hasManagePermission && !["SIGNUP_OPEN", "SIGNUP_CLOSED"].includes(eventdata.status))
    return NextResponse.json({error: "Die Anmeldung dieses Events ist geschlossen - Bitte wende dich an das Eventteam"}, {status: 500}) 
 
  try {
    // Check if deletion is after deadline and should notify team
    const isAfterDeadline = eventdata.signupDeadline && new Date() > new Date(eventdata.signupDeadline);
    
    if (hardDelete && hasManagePermission) {
      // Hard delete - actually remove from database
      await prisma.eventSignup.delete({
        where: {
          eventId_userCID: {
            eventId: parseInt(eventId, 10),
            userCID: parseInt(userId, 10),
          },
        },
      });
    } else {
      // Soft delete - just mark as deleted
      await prisma.eventSignup.update({
        where: {
          eventId_userCID: {
            eventId: parseInt(eventId, 10),
            userCID: parseInt(userId, 10),
          },
        },
        data: {
          deletedAt: new Date(),
          deletedBy: Number(session.user.cid),
        },
      });
      
      // Send notification if deleted after deadline and not by event team
      if (isAfterDeadline && !hasManagePermission) {
        await sendChangeNotificationToEventTeam(
          parseInt(eventId, 10),
          parseInt(userId, 10),
          session.user.name || 'Unknown',
          [{ field: 'signup', oldValue: 'aktiv', newValue: 'gelöscht' }],
          eventdata.firCode
        );
      }
    }

    await invalidateSignupTable(Number(eventId))
    return NextResponse.json({ success: true, hardDelete });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}

// Helper function to send notifications to event team
async function sendChangeNotificationToEventTeam(
  eventId: number,
  userCID: number,
  userName: string,
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
  firCode: string | null
) {
  try {
    if (!prisma) {
      return;
    }
    if (!firCode) return;

    // Find all users in event team (with signups.manage permission for this FIR)
    const eventTeamGroups = await prisma.group.findMany({
      where: {
        firId: {
          in: await prisma.fIR.findMany({
            where: { code: firCode },
            select: { id: true }
          }).then(firs => firs.map(f => f.id))
        },
        permissions: {
          some: {
            permission: {
              key: 'signups.manage'
            }
          }
        }
      },
      include: {
        members: true
      }
    });

    const eventTeamCIDs = new Set<number>();
    eventTeamGroups.forEach(group => {
      group.members.forEach(member => {
        eventTeamCIDs.add(member.userCID);
      });
    });

    // Create change description
    const changeDescriptions = changes.map(c => {
      if (c.field === 'availability') {
        return 'Verfügbarkeit geändert';
      } else if (c.field === 'preferredStations') {
        return `Gewünschte Position: ${c.oldValue || '-'} → ${c.newValue || '-'}`;
      } else if (c.field === 'remarks') {
        return 'Bemerkungen geändert';
      } else if (c.field === 'excludedAirports') {
        return 'Ausgeschlossene Airports geändert';
      } else if (c.field === 'signup') {
        return `Anmeldung ${c.newValue}`;
      }
    }).join(', ');

    // Create notifications for each event team member
    const notifications = Array.from(eventTeamCIDs).map(cid => ({
      userCID: cid,
      eventId: eventId,
      type: 'EVENT' as const,
      title: 'Anmeldungsänderung nach Deadline',
      message: `${userName} (CID: ${userCID}) hat die Anmeldung nach der Deadline geändert: ${changeDescriptions}`,
      data: JSON.parse(JSON.stringify({ changes, userCID, userName }))
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
      data: notifications
      });
    }

    // Send notifications via VATGER API
    const vatgerNotifications = Array.from(eventTeamCIDs).map(cid => ({
      cid: cid,
      data: {
        title: 'Anmeldungsänderung nach Deadline',
        message: `${userName} (CID: ${userCID}) hat die Anmeldung nach der Deadline geändert: ${changeDescriptions}`,
        source_name: "Eventsystem",
        link_text: ".",
        link_url: `${process.env.NEXTAUTH_URL}/events/${eventId}`,
        via: "board.ping"
      }
    }));

    for (const notification of vatgerNotifications) {
      try {
        await fetch(`${process.env.VATGER_API}/${notification.cid}/send_notification`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${process.env.VATGER_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notification.data)
      });
      } catch (error) {
      console.error(`Error sending VATGER notification to CID ${notification.cid}:`, error);
      }
    }
  } catch (error) {
    console.error('Error sending change notifications:', error);
    // Don't throw - notifications are not critical
  }
}
