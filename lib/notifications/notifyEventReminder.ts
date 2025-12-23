import { prisma } from "@/lib/prisma";

const VATGER_API_TOKEN = process.env.VATGER_API_TOKEN!;

/**
 * Sends reminder notifications to FIR event leaders about events
 * where signup registration has not been opened yet
 * @param eventId The ID of the event to send reminders for
 * @returns Number of notifications sent successfully
 */
export async function notifyEventReminder(eventId: number) {
  const event = await prisma!.event.findUnique({ 
    where: { id: eventId },
    include: {
      fir: {
        include: {
          groups: {
            where: {
              kind: "FIR_LEITUNG"
            },
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      }
    }
  });
  
  if (!event) {
    console.error(`[Event Reminder] Event ${eventId} not found`);
    return 0;
  }

  if (!event.fir) {
    console.error(`[Event Reminder] Event ${eventId} has no FIR assigned`);
    return 0;
  }

  // Get all FIR_LEITUNG members for this event's FIR
  const firLeaders = event.fir.groups.flatMap(group => 
    group.members.map(member => member.user)
  );

  if (firLeaders.length === 0) {
    console.log(`[Event Reminder] No FIR leaders found for FIR ${event.fir.code}`);
    return 0;
  }

  const message = `Erinnerung: Das Event "${event.name}" startet in 3 Wochen (${event.startTime.toLocaleDateString("de-DE")}). Die Controlleranmeldung ist noch nicht geöffnet.`;

  // Create internal notifications
  await prisma!.$transaction(
    firLeaders.map((leader) =>
      prisma!.notification.create({
        data: {
          userCID: leader.cid,
          eventId,
          type: "EVENT",
          title: "Event-Erinnerung",
          message,
        },
      })
    )
  );

  // Send external notifications via VATGER API
  const results = await Promise.allSettled(
    firLeaders.map((leader) => {
      const isEmailNotifEnabled = leader.emailNotificationsEnabled ?? false;
      const body = {
        title: `Event-Erinnerung – ${event.name}`,
        message,
        source_name: "Eventsystem",
        link_text: "Event ansehen",
        link_url: `${process.env.NEXTAUTH_URL}/admin/events/${event.id}`,
        ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
      };
      return fetch(`${process.env.VATGER_API}/${leader.cid}/send_notification`, {
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
  console.log(`[Event Reminder] Sent ${successCount}/${firLeaders.length} notifications for event ${event.name}`);
  
  return successCount;
}
