import prisma from "@/lib/prisma";

/**
 * Send notifications when a roster is published
 * - In-app notifications for all signed-up users
 * - External notifications (email/forum via VATGER API) for users
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://event-manager.vatger.de";
    const link = `${baseUrl}/weeklys/${configId}/occurrences/${occurrenceId}`;

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
              userCID: signup.userCID,
              eventId: null,
              type: "INFO",
              title: title,
              message: message,
              data: {
                occurrenceId: occurrenceId,
                configId: configId,
                link: link,
                station: station || null,
              },
            },
          });
        } catch (error) {
          console.error(`[WEEKLY NOTIF] Failed to create in-app notification for user ${signup.userCID}:`, error);
        }

        // Send external notification via VATGER API
        try {
          // Fetch user to check email notification preference
          const user = await prisma.user.findUnique({
            where: { cid: signup.userCID },
            select: { 
              cid: true, 
              emailNotificationsEnabled: true 
            },
          });

          if (!user) {
            console.error(`[WEEKLY NOTIF] User ${signup.userCID} not found`);
            continue;
          }

          // Determine notification method based on user preference
          const isEmailNotifEnabled = user.emailNotificationsEnabled ?? false;
          
          const notificationBody = {
            title: title,
            message: `[${occurrence.config.name}] ${message}`,
            source_name: "Weekly Events",
            link_text: "Jetzt ansehen",
            link_url: link,
            ...(isEmailNotifEnabled ? {} : { via: "board.ping" }),
          };

          // Call VATGER API to send notification
          const response = await fetch(`${process.env.VATGER_API}/${signup.userCID}/send_notification`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.VATGER_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(notificationBody),
          });

          if (!response.ok) {
            console.error(`[WEEKLY NOTIF] VATGER API error for user ${signup.userCID}: ${response.status} ${response.statusText}`);
          }
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

    if (occurrence.config.fir.code !== "EDMM") {
      console.log("[WEEKLY DISCORD] Discord notification only for EDMM events");
      return;
    }

    const discordBotUrl = process.env.DISCORD_BOT_URL;
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_EDMM_CHANNEL_ID;
    const roleId = process.env.DISCORD_EDMM_ROLE_ID;

    if (!discordBotUrl || !discordBotToken || !channelId || !roleId) {
      console.error("[WEEKLY DISCORD] Discord bot configuration missing in env variables");
      return;
    }

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

    const message = `<@&${roleId}>

**Anmeldeschluss für Weekly Event: ${occurrence.config.name}**

📅 Datum: ${eventDate}, ${eventTime} UTC

Die Anmeldung ist nun geschlossen. Ihr könnt nun mit der Roster-Planung beginnen.

🔗 Roster Editor: ${rosterEditorLink}`;

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
      console.error(`[WEEKLY DISCORD] Discord API error: ${response.status} ${response.statusText}`);
      return;
    }

    console.log(`[WEEKLY DISCORD] Successfully sent signup deadline notification for occurrence ${occurrenceId}`);
  } catch (error) {
    console.error("[WEEKLY DISCORD] Error sending Discord notification:", error);
  }
}
