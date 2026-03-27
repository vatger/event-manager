import { prisma } from "@/lib/prisma";

const VATGER_API_TOKEN = process.env.VATGER_API_TOKEN!;

/**
 * Sends reminder notifications to all signed-up users for an event,
 * 1 day before the signup deadline.
 * Reminds them they are registered and encourages early cancellation if needed.
 * @param eventId The ID of the event to send reminders for
 * @returns Number of notifications sent successfully
 */
export async function notifySignupDeadlineReminder(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    console.error(`[Signup Reminder] Event ${eventId} not found`);
    return 0;
  }

  // Fetch all active (non-deleted) signups
  const signups = await prisma.eventSignup.findMany({
    where: {
      eventId,
      deletedAt: null,
      //notifications should only be sent to users who haven't updated their signup in the last 7 days
      updatedAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    },
    include: {
      user: {
        select: {
          cid: true,
          emailNotificationsEnabled: true,
        },
      },
    },
  });

  if (signups.length === 0) {
    console.log(`[Signup Reminder] No active signups for event ${eventId}`);
    return 0;
  }

  const eventDate = event.startTime.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const deadlineStr = event.signupDeadline
    ? event.signupDeadline.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const title = `Erinnerung: Anmeldung für ${event.name}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://event.vatger.de";
  const link = `${baseUrl}/events/${event.id}`;

  let message = `Du bist für das Event "${event.name}" am ${eventDate} angemeldet.`;
  if (deadlineStr) {
    message += ` Der Anmeldeschluss ist am ${deadlineStr}.`;
  }
  message += ` Falls du nicht teilnehmen kannst, melde dich bitte rechtzeitig ab.`;

  let successCount = 0;

  for (const signup of signups) {
    try {
      // Create in-app notification
      await prisma.notification.create({
        data: {
          userCID: signup.userCID,
          eventId,
          type: "EVENT",
          title,
          message,
          data: {
            eventId,
            link,
          },
        },
      });
    } catch (error) {
      console.error(
        `[Signup Reminder] Failed to create in-app notification for user ${signup.userCID}:`,
        error
      );
    }

    // Send external notification via VATGER API
    try {
      const isEmailNotifEnabled = signup.user.emailNotificationsEnabled ?? false;
      const body = {
        title,
        message,
        source_name: "Eventsystem",
        link_text: "Event ansehen",
        link_url: link,
        ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
      };

      const response = await fetch(
        `${process.env.VATGER_API}/${signup.userCID}/send_notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VATGER_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (response.ok) {
        successCount++;
      } else {
        console.error(
          `[Signup Reminder] VATGER API error for user ${signup.userCID}: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(
        `[Signup Reminder] Failed to send external notification for user ${signup.userCID}:`,
        error
      );
    }
  }

  console.log(
    `[Signup Reminder] Sent ${successCount}/${signups.length} reminders for event "${event.name}"`
  );
  return successCount;
}
