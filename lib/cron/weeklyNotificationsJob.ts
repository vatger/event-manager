import { prisma } from "@/lib/prisma";
import { addDays, subDays } from "date-fns";
import { sendSignupDeadlineDiscordNotification } from "@/lib/weeklys/notificationService";

/**
 * Checks weekly occurrences and manages their signup status automatically
 * - Opens signups 14 days before occurrence (auto → open)
 * - Closes signups at deadline (open → closed)
 * - Sends notifications on status changes
 */
export async function checkWeeklyOccurrenceStatus() {
  console.log("[Weekly Status] Checking weekly occurrences for status updates...");
  
  try {
    const now = new Date();
    const thirtyDaysFromNow = addDays(now, 30);

    // Find occurrences in the next 30 days (only for weeklys that require roster)
    const occurrences = await prisma.weeklyEventOccurrence.findMany({
      where: {
        date: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        rosterPublished: false, // Skip if roster already published
        config: {
          requiresRoster: true, // Only process weeklys that need signup management
        },
      },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
        _count: {
          select: {
            signups: true,
          },
        },
      },
    });

    if (occurrences.length === 0) {
      console.log("[Weekly Status] No occurrences found in next 30 days");
      return {
        checked: 0,
        signupsOpened: 0,
        signupsClosed: 0,
        notificationsSent: 0,
      };
    }

    console.log(`[Weekly Status] Found ${occurrences.length} occurrence(s) to check`);

    let signupsOpened = 0;
    let signupsClosed = 0;
    let notificationsSent = 0;

    for (const occurrence of occurrences) {
      const occurrenceDate = new Date(occurrence.date);
      const fourteenDaysBefore = subDays(occurrenceDate, 14);
      const signupDeadline = occurrence.signupDeadline ? new Date(occurrence.signupDeadline) : null;

      // Check if signups should be opened (14 days before)
      if (occurrence.signupStatus === "auto" && now >= fourteenDaysBefore) {
        console.log(
          `[Weekly Status] Opening signups for occurrence ${occurrence.id} (${occurrence.config.name})`
        );
        
        await prisma.weeklyEventOccurrence.update({
          where: { id: occurrence.id },
          data: { signupStatus: "open" },
        });
        
        signupsOpened++;
      }

      // Check if signups should be closed (deadline passed)
      if (
        signupDeadline &&
        now > signupDeadline &&
        occurrence.signupStatus === "open"
      ) {
        console.log(
          `[Weekly Status] Closing signups for occurrence ${occurrence.id} (${occurrence.config.name})`
        );
        
        await prisma.weeklyEventOccurrence.update({
          where: { id: occurrence.id },
          data: { signupStatus: "closed" },
        });
        
        signupsClosed++;

        // Send Discord notification for EDMM events (only if deadline within last 24h)
        const hoursSinceDeadline = (now.getTime() - signupDeadline.getTime()) / (1000 * 60 * 60);
        
        if (occurrence.config.fir?.code === "EDMM" && hoursSinceDeadline < 24) {
          try {
            await sendSignupDeadlineDiscordNotification(occurrence.id, occurrence.configId);
            notificationsSent++;
            console.log(
              `[Weekly Status] Sent deadline notification for occurrence ${occurrence.id}`
            );
          } catch (error) {
            console.error(
              `[Weekly Status] Failed to send notification for occurrence ${occurrence.id}:`,
              error
            );
          }
        }
      }

      // TODO: Check for insufficient signups 24h before (reminder)
      // This would check if signups < required stations and send a reminder
    }

    const summary = {
      checked: occurrences.length,
      signupsOpened,
      signupsClosed,
      notificationsSent,
    };

    console.log("[Weekly Status] Check completed:", summary);
    return summary;
  } catch (error) {
    console.error("[Weekly Status] Error checking occurrences:", error);
    throw error;
  }
}
