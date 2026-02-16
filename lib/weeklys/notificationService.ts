import prisma from "@/lib/prisma";
import { sendNotificationEmail, sendNotificationForum } from "@/lib/notifications/notificationService";

/**
 * Send notifications when a roster is published
 * - In-app notifications for all signed-up users
 * - External notifications (email/forum) for users with email enabled
 * - Include station assignment info for rostered users
 */
export async function sendRosterPublishedNotifications(
  occurrenceId: number,
  configId: number
) {
  try {
    // Fetch occurrence with config and related data
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence) {
      console.error("[WEEKLY NOTIF] Occurrence not found for notifications");
      return;
    }

    // Fetch all signups
    const signups = await prisma.weeklyEventSignup.findMany({
      where: { occurrenceId },
    });

    if (signups.length === 0) {
      console.log("[WEEKLY NOTIF] No signups found for occurrence", occurrenceId);
      return;
    }

    // Fetch roster to determine station assignments
    const rosterEntries = await prisma.weeklyEventRoster.findMany({
      where: { occurrenceId },
    });

    // Create a map of userCID to station
    const userStations = new Map<number, string>();
    for (const entry of rosterEntries) {
      userStations.set(entry.userCID, entry.station);
    }

    // Format date for message
    const eventDate = occurrence.date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const eventTime = occurrence.date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    const title = `Roster veröffentlicht: ${occurrence.config.name}`;
    const link = `/weeklys/${configId}/occurrences/${occurrenceId}`;

    // Send notification to each signed-up user
    for (const signup of signups) {
      try {
        const station = userStations.get(signup.userCID);
        
        let message = `Das Roster für ${occurrence.config.name} am ${eventDate}, ${eventTime} UTC wurde veröffentlicht.`;
        
        if (station) {
          message += ` Du wurdest für Station ${station} eingeteilt.`;
        }

        // Create in-app notification (always)
        try {
          await prisma.notification.create({
            data: {
              userId: signup.userCID,
              title: title,
              message: message,
              link: link,
              type: "INFO",
            },
          });
        } catch (error) {
          console.error(`[WEEKLY NOTIF] Failed to create in-app notification for user ${signup.userCID}:`, error);
        }

        // Send external notification (email/forum) - only if user has email notifications enabled
        try {
          // Fetch user to check email notification preference
          const user = await prisma.user.findUnique({
            where: { cid: signup.userCID },
            select: { 
              cid: true, 
              emailNotificationsEnabled: true 
            },
          });

          // Send email notification if user has email notifications enabled
          if (user?.emailNotificationsEnabled) {
            await sendNotificationEmail(
              signup.userCID,
              title,
              message,
              link
            );
          }

          // Always send forum notification
          await sendNotificationForum(
            signup.userCID,
            title,
            message,
            link
          );
        } catch (error) {
          console.error(`[WEEKLY NOTIF] Failed to send external notification for user ${signup.userCID}:`, error);
        }
      } catch (error) {
        console.error(`[WEEKLY NOTIF] Error processing notification for user ${signup.userCID}:`, error);
      }
    }

    console.log(`[WEEKLY NOTIF] Sent roster published notifications for occurrence ${occurrenceId} to ${signups.length} users`);
  } catch (error) {
    console.error("[WEEKLY NOTIF] Error sending roster published notifications:", error);
  }
}

/**
 * Send Discord notification when signup deadline passes (EDMM only)
 * Notifies event team that roster planning can begin
 */
export async function sendSignupDeadlineDiscordNotification(
  occurrenceId: number,
  configId: number
) {
  try {
    // Fetch occurrence with config
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence) {
      console.error("[WEEKLY DISCORD] Occurrence not found for Discord notification");
      return;
    }

    // Only send for EDMM (Munich FIR)
    if (occurrence.config.fir.code !== "EDMM") {
      console.log("[WEEKLY DISCORD] Discord notification only for EDMM events");
      return;
    }

    // Check if Discord bot configuration exists
    const discordBotUrl = process.env.DISCORD_BOT_URL;
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_EDMM_CHANNEL_ID;
    const roleId = process.env.DISCORD_EDMM_ROLE_ID;

    if (!discordBotUrl || !discordBotToken || !channelId || !roleId) {
      console.error("[WEEKLY DISCORD] Discord bot configuration missing in env variables:", {
        hasUrl: !!discordBotUrl,
        hasToken: !!discordBotToken,
        hasChannelId: !!channelId,
        hasRoleId: !!roleId,
      });
      return;
    }

    // Format date for message
    const eventDate = occurrence.date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const eventTime = occurrence.date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://event-manager.vatger.de";
    const rosterEditorLink = `${baseUrl}/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`;

    // Create Discord message
    const message = `<@&${roleId}>

**Anmeldeschluss für Weekly Event: ${occurrence.config.name}**

📅 Datum: ${eventDate}, ${eventTime} UTC

Die Anmeldung ist nun geschlossen. Ihr könnt nun mit der Roster-Planung beginnen.

🔗 Roster Editor: ${rosterEditorLink}`;

    // Send Discord notification
    const response = await fetch(discordBotUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${discordBotToken}`,
      },
      body: JSON.stringify({
        channel_id: channelId,
        message: message,
        role_id: roleId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error response");
      console.error(`[WEEKLY DISCORD] Discord API error: ${response.status} ${response.statusText}`, errorText);
      return;
    }

    console.log(`[WEEKLY DISCORD] Successfully sent signup deadline notification for occurrence ${occurrenceId}`);
  } catch (error) {
    console.error("[WEEKLY DISCORD] Error sending Discord notification:", error);
  }
}
