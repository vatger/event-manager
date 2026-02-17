import { prisma } from "@/lib/prisma";
import { addHours, subHours } from "date-fns";
import { 
  checkStaffingFeasibility, 
  formatStaffingCheckMessage,
  StaffingCheckResult 
} from "@/lib/weeklys/staffingCheck";

// In-memory cache to track which occurrences have already been checked
// This prevents duplicate notifications
const checkedOccurrences = new Set<number>();

/**
 * Checks staffing feasibility for EDMM weekly events 24 hours before signup deadline
 * Sends Discord notification to event team if staffing is insufficient
 */
export async function checkWeeklyStaffing() {
  console.log("[Weekly Staffing] Checking staffing for upcoming weekly events...");

  try {
    const now = new Date();
    const in25Hours = addHours(now, 25); // Check window: 24-25 hours before deadline
    const in23Hours = addHours(now, 23);

    // Find occurrences with signup deadline in the next 24-25 hours
    // Only check EDMM events that require roster and haven't published yet
    const occurrences = await prisma.weeklyEventOccurrence.findMany({
      where: {
        signupDeadline: {
          gte: in23Hours,
          lte: in25Hours,
        },
        rosterPublished: false,
        config: {
          requiresRoster: true,
          fir: {
            code: "EDMM", // Only EDMM events
          },
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
      console.log("[Weekly Staffing] No occurrences found in 24h deadline window");
      return {
        checked: 0,
        insufficient: 0,
        notificationsSent: 0,
      };
    }

    console.log(`[Weekly Staffing] Found ${occurrences.length} occurrence(s) to check`);

    let insufficient = 0;
    let notificationsSent = 0;

    for (const occurrence of occurrences) {
      // Skip if already checked
      if (checkedOccurrences.has(occurrence.id)) {
        console.log(`[Weekly Staffing] Occurrence ${occurrence.id} already checked, skipping`);
        continue;
      }

      console.log(
        `[Weekly Staffing] Checking staffing for occurrence ${occurrence.id} (${occurrence.config.name})`
      );

      try {
        // Perform staffing check
        const checkResult = await checkStaffingFeasibility(occurrence.id);

        // Mark as checked to prevent duplicate checks
        checkedOccurrences.add(occurrence.id);

        if (!checkResult.isFeasible) {
          insufficient++;
          console.log(
            `[Weekly Staffing] Insufficient staffing for occurrence ${occurrence.id}:`,
            checkResult.reasons.join(", ")
          );

          // Send Discord notification
          try {
            await sendStaffingAlert(occurrence.id, occurrence.config.id, checkResult);
            notificationsSent++;
            console.log(
              `[Weekly Staffing] Sent staffing alert for occurrence ${occurrence.id}`
            );
          } catch (error) {
            console.error(
              `[Weekly Staffing] Failed to send notification for occurrence ${occurrence.id}:`,
              error
            );
          }
        } else {
          console.log(
            `[Weekly Staffing] Staffing is sufficient for occurrence ${occurrence.id}`
          );
        }
      } catch (error) {
        console.error(
          `[Weekly Staffing] Error checking occurrence ${occurrence.id}:`,
          error
        );
      }
    }

    const summary = {
      checked: occurrences.length,
      insufficient,
      notificationsSent,
    };

    console.log("[Weekly Staffing] Check completed:", summary);
    return summary;
  } catch (error) {
    console.error("[Weekly Staffing] Error checking staffing:", error);
    throw error;
  }
}

/**
 * Sends Discord notification about insufficient staffing
 */
async function sendStaffingAlert(
  occurrenceId: number,
  configId: number,
  checkResult: StaffingCheckResult
) {
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
    console.error("[Weekly Staffing] Occurrence not found for alert");
    return;
  }

  const discordBotUrl = process.env.DISCORD_BOT_URL;
  const discordBotToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_EDMM_CHANNEL_ID;
  const roleId = process.env.DISCORD_EDMM_ROLE_ID;

  if (!discordBotUrl || !discordBotToken || !channelId || !roleId) {
    console.error("[Weekly Staffing] Discord bot configuration missing in env variables");
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://event.vatger.de";
  const rosterEditorLink = `${baseUrl}/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`;

  const message = formatStaffingCheckMessage(
    checkResult,
    occurrence.config.name,
    occurrence.date
  );

  const fullMessage = `${message}\n\nRoster Editor: ${rosterEditorLink}`;

  const response = await fetch(discordBotUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${discordBotToken}`,
    },
    body: JSON.stringify({
      channel_id: channelId,
      message: fullMessage,
      role_id: roleId,
    }),
  });

  if (!response.ok) {
    console.error(`[Weekly Staffing] Discord API error: ${response.status} ${response.statusText}`);
    throw new Error(`Discord API returned ${response.status}`);
  }

  console.log(`[Weekly Staffing] Successfully sent staffing alert for occurrence ${occurrenceId}`);
}

/**
 * Clear the cache of checked occurrences (for testing or manual reset)
 */
export function resetStaffingCheckCache() {
  checkedOccurrences.clear();
  console.log("[Weekly Staffing] Check cache cleared");
}
