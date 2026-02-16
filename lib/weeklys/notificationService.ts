import prisma from "@/lib/prisma";

/**
 * Send notifications when a roster is published
 * - In-app notifications for all signed-up users
 * - Forum notifications via VATGER API
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
      console.error("Occurrence not found for notifications");
      return;
    }

    // Fetch all signups
    const signups = await prisma.weeklyEventSignup.findMany({
      where: { occurrenceId },
    });

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

    // Send notification to each signed-up user
    for (const signup of signups) {
      const station = userStations.get(signup.userCID);
      
      let message = `Das Roster für ${occurrence.config.name} am ${eventDate}, ${eventTime} UTC wurde veröffentlicht.`;
      
      if (station) {
        message += ` Du wurdest für Station ${station} eingeteilt.`;
      }

      // Create in-app notification
      try {
        await prisma.notification.create({
          data: {
            userId: signup.userCID,
            title: `Roster veröffentlicht: ${occurrence.config.name}`,
            message: message,
            link: `/weeklys/${configId}/occurrences/${occurrenceId}`,
            type: "INFO",
          },
        });
      } catch (error) {
        console.error(`Failed to create in-app notification for user ${signup.userCID}:`, error);
      }

      // Send forum notification via VATGER API
      try {
        if (process.env.VATGER_API_URL) {
          await fetch(`${process.env.VATGER_API_URL}/notifications`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: signup.userCID,
              title: `Roster veröffentlicht: ${occurrence.config.name}`,
              message: message,
              link: `/weeklys/${configId}/occurrences/${occurrenceId}`,
            }),
          });
        }
      } catch (error) {
        console.error(`Failed to send VATGER API notification for user ${signup.userCID}:`, error);
      }
    }

    console.log(`Sent roster published notifications for occurrence ${occurrenceId} to ${signups.length} users`);
  } catch (error) {
    console.error("Error sending roster published notifications:", error);
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
      console.error("Occurrence not found for Discord notification");
      return;
    }

    // Only send for EDMM (Munich FIR)
    if (occurrence.config.fir.code !== "EDMM") {
      console.log("Discord notification only for EDMM events");
      return;
    }

    // Check if Discord bot configuration exists
    const discordBotUrl = process.env.DISCORD_BOT_URL;
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_EDMM_CHANNEL_ID;
    const roleId = process.env.DISCORD_EDMM_ROLE_ID;

    if (!discordBotUrl || !discordBotToken || !channelId || !roleId) {
      console.error("Discord bot configuration missing in env variables");
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

    // Create Discord message
    const message = `<@&${roleId}>

**Anmeldeschluss für Weekly Event: ${occurrence.config.name}**

📅 Datum: ${eventDate}, ${eventTime} UTC

Die Anmeldung ist nun geschlossen. Ihr könnt nun mit der Roster-Planung beginnen.

🔗 Roster Editor: ${process.env.NEXT_PUBLIC_BASE_URL || "https://event-manager.vatger.de"}/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`;

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
      console.error(`Discord API error: ${response.status} ${response.statusText}`);
      return;
    }

    console.log(`Sent Discord signup deadline notification for occurrence ${occurrenceId}`);
  } catch (error) {
    console.error("Error sending Discord notification:", error);
  }
}
