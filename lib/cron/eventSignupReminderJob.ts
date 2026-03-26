import { prisma } from "@/lib/prisma";
import { addHours } from "date-fns";
import { notifySignupDeadlineReminder } from "../notifications/notifySignupReminder";

/**
 * Checks for events whose signup deadline falls within the next 24 hours
 * and sends a reminder to all currently signed-up users (once per event).
 */
export async function checkEventSignupReminders() {
  console.log("[Signup Reminder] Checking for events with upcoming signup deadlines...");

  try {
    const now = new Date();
    const in24Hours = addHours(now, 24);

    // Find events where:
    // 1. Signup deadline is within the next 24 hours (but hasn't passed yet)
    // 2. Reminder has not been sent yet
    // 3. Signups are open (status SIGNUP_OPEN)
    const events = await prisma.event.findMany({
      where: {
        signupDeadline: {
          gt: now,
          lte: in24Hours,
        },
        signupReminderSent: false,
        status: "SIGNUP_OPEN",
      },
    });

    if (events.length === 0) {
      console.log("[Signup Reminder] No events with upcoming signup deadlines found");
      return {
        eventsChecked: 0,
        notificationsSent: 0,
      };
    }

    console.log(`[Signup Reminder] Found ${events.length} event(s) needing reminders`);

    const results = await Promise.allSettled(
      events.map(async (event) => {
        console.log(
          `[Signup Reminder] Processing event: ${event.name} (ID: ${event.id})`
        );

        const count = await notifySignupDeadlineReminder(event.id);

        // Mark reminder as sent so the job doesn't retry and send duplicates,
        // even if some individual notifications failed (partial failures are acceptable).
        await prisma.event.update({
          where: { id: event.id },
          data: { signupReminderSent: true },
        });

        return { eventId: event.id, eventName: event.name, count };
      })
    );

    const totalNotifications = results.reduce((sum, result) => {
      if (result.status === "fulfilled") {
        return sum + result.value.count;
      }
      return sum;
    }, 0);

    console.log(
      `[Signup Reminder] Completed: ${events.length} event(s) checked, ${totalNotifications} total notifications sent`
    );

    return {
      eventsChecked: events.length,
      notificationsSent: totalNotifications,
      results: results.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { error: r.reason?.message || "Unknown error" }
      ),
    };
  } catch (error) {
    console.error("[Signup Reminder] Error checking events:", error);
    throw error;
  }
}