import { prisma } from "@/lib/prisma";
import { notifyEventReminder } from "@/lib/notifications/notifyEventReminder";
import { addDays, startOfDay, endOfDay } from "date-fns";

/**
 * Checks for events that start in exactly 3 weeks (21 days)
 * and where signup registration has not been opened yet.
 * Sends reminder notifications to FIR event leaders.
 */
export async function checkUpcomingEventsForReminders() {
  console.log("[Event Reminder] Checking for upcoming events that need reminders...");
  
  try {
    // Calculate date range for events starting in 3 weeks (21 days from now)
    const targetDate = addDays(new Date(), 21);
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    // Find events that:
    // 1. Start in exactly 3 weeks (within the target day)
    // 2. Are not yet in SIGNUP_OPEN, SIGNUP_CLOSED, ROSTER_PUBLISHED, or CANCELLED status
    const eventsNeedingReminder = await prisma.event.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: {
          notIn: ["SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "CANCELLED"],
        },
        firCode: {
          not: null, // Only events with assigned FIR
        },
      },
      include: {
        fir: true,
      },
    });

    if (eventsNeedingReminder.length === 0) {
      console.log("[Event Reminder] No events found that need reminders");
      return {
        eventsChecked: 0,
        notificationsSent: 0,
      };
    }

    console.log(
      `[Event Reminder] Found ${eventsNeedingReminder.length} event(s) that need reminders`
    );

    // Send reminders for each event
    const results = await Promise.allSettled(
      eventsNeedingReminder.map(async (event) => {
        console.log(
          `[Event Reminder] Processing event: ${event.name} (ID: ${event.id}, FIR: ${event.fir?.code})`
        );
        const count = await notifyEventReminder(event.id);
        return { eventId: event.id, eventName: event.name, count };
      })
    );

    // Count total notifications sent
    const totalNotifications = results.reduce((sum, result) => {
      if (result.status === "fulfilled") {
        return sum + result.value.count;
      }
      return sum;
    }, 0);

    console.log(
      `[Event Reminder] Completed: ${eventsNeedingReminder.length} event(s) checked, ${totalNotifications} total notifications sent`
    );

    return {
      eventsChecked: eventsNeedingReminder.length,
      notificationsSent: totalNotifications,
      results: results.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { error: r.reason?.message || "Unknown error" }
      ),
    };
  } catch (error) {
    console.error("[Event Reminder] Error checking events:", error);
    throw error;
  }
}
