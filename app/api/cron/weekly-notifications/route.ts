import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendSignupDeadlineDiscordNotification } from "@/lib/weeklys/notificationService";

/**
 * Cron endpoint to check weekly event occurrences and:
 * 1. Close signups when deadline passes (status change)
 * 2. Send Discord notifications to EDMM team when status changes to closed
 * 3. Send 24h reminders if insufficient signups
 * 
 * This is pure server logic - no page dependencies!
 * Should be called by cron every 15-30 minutes.
 * 
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CRON] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[CRON] Unauthorized access attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CRON] Weekly notifications check started");

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Fetch all occurrences in the next 30 days
    const occurrences = await prisma.weeklyEventOccurrence.findMany({
      where: {
        date: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Include last 24h for deadline checks
          lte: thirtyDaysFromNow,
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

    console.log(`[CRON] Found ${occurrences.length} occurrences to check`);

    let deadlineNotifications = 0;
    let statusUpdates = 0;
    const details: any[] = [];

    // Check each occurrence
    for (const occurrence of occurrences) {
      try {
        // Skip if roster already published
        if (occurrence.rosterPublished) {
          continue;
        }

        // Only process EDMM events
        if (occurrence.config.fir.code !== "EDMM") {
          continue;
        }

        // Check if deadline has passed and status should be closed
        if (occurrence.signupDeadline && now > occurrence.signupDeadline) {
          const currentStatus = occurrence.signupStatus;

          // If status is "auto" or "open", check if we should close it
          if (currentStatus === "auto" || currentStatus === "open") {
            // Check if deadline passed within last 24 hours (to send notification)
            const hoursSinceDeadline = (now.getTime() - occurrence.signupDeadline.getTime()) / (1000 * 60 * 60);
            const shouldNotify = hoursSinceDeadline <= 24;

            // Update status to closed
            await prisma.weeklyEventOccurrence.update({
              where: { id: occurrence.id },
              data: { signupStatus: "closed" },
            });

            statusUpdates++;
            console.log(`[CRON] Closed signups for occurrence ${occurrence.id} (deadline passed)`);

            // Send Discord notification if deadline just passed
            if (shouldNotify) {
              try {
                await sendSignupDeadlineDiscordNotification(
                  occurrence.id,
                  occurrence.configId
                );
                deadlineNotifications++;
                console.log(`[CRON] Sent deadline notification for occurrence ${occurrence.id}`);

                details.push({
                  occurrenceId: occurrence.id,
                  type: "deadline",
                  action: "status_closed_and_notified",
                  configName: occurrence.config.name,
                  date: occurrence.date,
                });
              } catch (notifError) {
                console.error(`[CRON] Failed to send deadline notification for occurrence ${occurrence.id}:`, notifError);
                details.push({
                  occurrenceId: occurrence.id,
                  type: "deadline",
                  action: "status_closed_notification_failed",
                  error: String(notifError),
                });
              }
            } else {
              details.push({
                occurrenceId: occurrence.id,
                type: "deadline",
                action: "status_closed_no_notification",
                reason: "deadline_too_old",
              });
            }
          }
        }

        // Check for 24h reminder (insufficient signups)
        // This is a separate check from deadline closure
        const hoursUntilEvent = (occurrence.date.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilEvent >= 24 && hoursUntilEvent <= 36) {
          // In the 24-36 hour window before event
          const signupCount = occurrence._count.signups;
          const requiredStations = occurrence.config.staffedStations?.length || 0;

          if (signupCount < requiredStations && requiredStations > 0) {
            // Not enough signups - send reminder
            // TODO: Implement 24h reminder notification
            // For now, just log it
            console.log(`[CRON] Insufficient signups for occurrence ${occurrence.id}: ${signupCount}/${requiredStations}`);
            details.push({
              occurrenceId: occurrence.id,
              type: "insufficient_signups",
              action: "reminder_needed",
              signups: signupCount,
              required: requiredStations,
            });
          }
        }
      } catch (occError) {
        console.error(`[CRON] Error processing occurrence ${occurrence.id}:`, occError);
        details.push({
          occurrenceId: occurrence.id,
          error: String(occError),
        });
      }
    }

    const result = {
      success: true,
      timestamp: now.toISOString(),
      checked: occurrences.length,
      statusUpdates,
      deadlineNotifications,
      details,
    };

    console.log(`[CRON] Completed: ${statusUpdates} status updates, ${deadlineNotifications} notifications sent`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[CRON] Fatal error in weekly notifications:", error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing (shows endpoint is alive)
export async function GET() {
  return NextResponse.json({
    endpoint: "weekly-notifications",
    description: "Cron endpoint for weekly event status checks and notifications",
    method: "POST",
    authentication: "Bearer token required (CRON_SECRET)",
    schedule: "Recommended: */15 * * * * (every 15 minutes)",
  });
}
