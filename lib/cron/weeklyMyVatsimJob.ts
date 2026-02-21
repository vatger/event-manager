import { prisma } from "@/lib/prisma";
import { addWeeks } from "date-fns";
import { checkMultipleOccurrences } from "@/lib/weeklys/myVatsimService";

/**
 * Daily CRON job to check weekly event occurrences on myVATSIM
 * Also sends notifications for EDMM events that are 2 weeks away and not registered
 */
export async function checkWeeklyMyVatsim() {
  console.log("[Weekly myVATSIM] Starting daily check...");

  try {
    const now = new Date();
    const threeMonthsFromNow = addWeeks(now, 12);
    const twoWeeksFromNow = addWeeks(now, 2);

    // Fetch upcoming occurrences that need checking
    const occurrences = await prisma.weeklyEventOccurrence.findMany({
      where: {
        date: {
          gte: now,
          lte: threeMonthsFromNow,
        },
        config: {
          enabled: true,
        },
      },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    if (occurrences.length === 0) {
      console.log("[Weekly myVATSIM] No upcoming occurrences found");
      return {
        checked: 0,
        registered: 0,
        notRegistered: 0,
        notificationsSent: 0,
      };
    }

    console.log(`[Weekly myVATSIM] Found ${occurrences.length} occurrence(s) to check`);

    // Prepare occurrences for batch check
    const occurrencesToCheck = occurrences.map(occ => ({
      id: occ.id,
      name: occ.config.name,
      date: occ.date,
    }));

    // Check all occurrences against myVATSIM
    const results = await checkMultipleOccurrences(occurrencesToCheck);

    let registered = 0;
    let notRegistered = 0;
    let notificationsSent = 0;

    // Update database and send notifications
    for (const occ of occurrences) {
      const isRegistered = results.get(occ.id) || false;

      // Update occurrence
      await prisma.weeklyEventOccurrence.update({
        where: { id: occ.id },
        data: {
          myVatsimChecked: true,
          myVatsimRegistered: isRegistered,
        },
      });

      if (isRegistered) {
        registered++;
      } else {
        notRegistered++;

        // Check if notification needed (EDMM only, 2 weeks before)
        const occurrenceDate = new Date(occ.date);
        const daysUntilOccurrence = Math.ceil(
          (occurrenceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send notification if event is in ~14 days and not registered
        if (
          occ.config.fir?.code === "EDMM" &&
          daysUntilOccurrence >= 13 &&
          daysUntilOccurrence <= 15
        ) {
          try {
            await sendEdmmNotification(occ.id, occ.config.name, occurrenceDate);
            notificationsSent++;
            console.log(
              `[Weekly myVATSIM] Sent notification for EDMM occurrence ${occ.id}`
            );
          } catch (error) {
            console.error(
              `[Weekly myVATSIM] Failed to send notification for occurrence ${occ.id}:`,
              error
            );
          }
        }
      }
    }

    const summary = {
      checked: occurrences.length,
      registered,
      notRegistered,
      notificationsSent,
    };

    console.log("[Weekly myVATSIM] Check completed:", summary);
    return summary;
  } catch (error) {
    console.error("[Weekly myVATSIM] Error during check:", error);
    throw error;
  }
}

/**
 * Send Discord notification to EDMM event team about missing myVATSIM registration
 */
async function sendEdmmNotification(
  occurrenceId: number,
  eventName: string,
  eventDate: Date
) {
  const discordBotUrl = process.env.DISCORD_BOT_URL;
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_EDMM_CHANNEL_ID;
  const roleId = process.env.DISCORD_EDMM_ROLE_ID;

  if (!discordBotUrl || !discordBotToken || !channelId || !roleId) {
    console.warn(
      "[Weekly myVATSIM] Discord bot configuration missing, skipping notification"
    );
    return;
  }

  const dateStr = eventDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://event.vatger.de";
  const adminLink = `${baseUrl}/admin/events`;

  const embed = {
    title: "myVATSIM Eintragung fehlt!",
    description:
      "Dieses Event findet in **2 Wochen** statt und ist noch **nicht in myVATSIM registriert**.",
    color: 0xffa500, // Orange (Warnung)
    fields: [
      {
        name: "Event",
        value: eventName,
        inline: false,
      },
      {
        name: "Datum",
        value: dateStr,
        inline: true,
      },
      {
        name: "Eventmanager",
        value: `[Zum Event](${adminLink})`,
        inline: true,
      },
      {
        name: "myVATSIM",
        value: "[Event registrieren](https://my.vatsim.net/)",
        inline: false,
      },
    ],
    footer: {
      text: "Weekly System • Eventmanager",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(discordBotUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${discordBotToken}`,
      },
      body: JSON.stringify({
        channel_id: channelId,
        message: "MyVatsim fehlt!",
        role_id: roleId,
        embed
      }),
    });

    if (!response.ok) {
      console.error(
        `[Weekly myVATSIM] Discord API error: ${response.status} ${response.statusText}`
      );
      throw new Error(`Discord API returned ${response.status}`);
    }

    console.log(
      `[Weekly myVATSIM] Successfully sent notification for occurrence ${occurrenceId}`
    );
  } catch (error) {
    console.error(
      `[Weekly myVATSIM] Error sending Discord notification:`,
      error
    );
    throw error;
  }
}
