import { prisma } from "@/lib/prisma";
import { vatsimService } from "@/discord-bot/services/vatsim.service";
import { addDays, format, startOfDay, isSameDay } from "date-fns";

/**
 * Service for checking if weekly events and irregular events are registered in myVATSIM
 */
export class MyVatsimEventCheckerService {
  /**
   * Check if weekly events are registered in myVATSIM for the specified days ahead
   * Updates the occurrence records with the check results
   */
  async checkWeeklyEvents() {
    const configs = await prisma!.weeklyEventConfiguration.findMany({
      where: {
        enabled: true,
      },
      include: {
        occurrences: {
          where: {
            date: {
              gte: startOfDay(new Date()),
            },
          },
          orderBy: {
            date: "asc",
          },
        },
      },
    });

    // Fetch events once for all checks
    const events = await vatsimService.getEvents();
    const results = [];

    for (const config of configs) {
      for (const occurrence of config.occurrences) {
        const daysUntilEvent = Math.floor(
          (occurrence.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we should verify this event (based on checkDaysAhead)
        if (daysUntilEvent <= config.checkDaysAhead && daysUntilEvent >= 0) {
          const isRegistered = this.isEventRegisteredInMyVatsim(
            config.name,
            occurrence.date,
            events
          );

          // Update occurrence record
          await prisma!.weeklyEventOccurrence.update({
            where: { id: occurrence.id },
            data: {
              myVatsimChecked: true,
              myVatsimRegistered: isRegistered,
            },
          });

          results.push({
            configId: config.id,
            configName: config.name,
            date: occurrence.date,
            isRegistered,
            daysUntilEvent,
            shouldNotify: !isRegistered && daysUntilEvent === config.checkDaysAhead,
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if irregular events from the event manager are registered in myVATSIM
   */
  async checkIrregularEvents() {
    const futureEvents = await prisma!.event.findMany({
      where: {
        startTime: {
          gte: new Date(),
        },
        status: {
          in: ["PLANNING", "SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED"],
        },
      },
      include: {
        fir: true,
      },
    });

    // Fetch events once for all checks
    const vatsimEvents = await vatsimService.getEvents();
    const results = [];

    for (const event of futureEvents) {
      const daysUntilEvent = Math.floor(
        (event.startTime.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check events that start within 14 days
      if (daysUntilEvent <= 14 && daysUntilEvent >= 0) {
        const isRegistered = this.isEventRegisteredInMyVatsim(
          event.name,
          event.startTime,
          vatsimEvents
        );

        results.push({
          eventId: event.id,
          eventName: event.name,
          firCode: event.firCode,
          date: event.startTime,
          isRegistered,
          daysUntilEvent,
          shouldNotify: !isRegistered && daysUntilEvent === 14, // Notify at 14 days
        });
      }
    }

    return results;
  }

  /**
   * Check if an event with the given name exists in myVATSIM for the specified date
   * Now accepts pre-fetched events to avoid redundant API calls
   */
  private isEventRegisteredInMyVatsim(
    eventName: string,
    eventDate: Date,
    events: Awaited<ReturnType<typeof vatsimService.getEvents>>
  ): boolean {
    // Check if any event matches the name and date
    const matchingEvent = events.find((e) => {
      const eventStartDate = new Date(e.start_time);
      
      // Check if name contains our event name (case insensitive)
      const nameMatch = e.name.toLowerCase().includes(eventName.toLowerCase()) ||
                       eventName.toLowerCase().includes(e.name.toLowerCase());
      
      // Check if dates match (same day)
      const dateMatch = isSameDay(eventStartDate, eventDate);
      
      return nameMatch && dateMatch;
    });

    return !!matchingEvent;
  }

  /**
   * Get all weekly events that need notification (not registered and at deadline)
   */
  async getWeeklyEventsNeedingNotification() {
    const checkResults = await this.checkWeeklyEvents();
    return checkResults.filter((r) => r.shouldNotify);
  }

  /**
   * Get all irregular events that need notification
   */
  async getIrregularEventsNeedingNotification() {
    const checkResults = await this.checkIrregularEvents();
    return checkResults.filter((r) => r.shouldNotify);
  }
}

export const myVatsimEventChecker = new MyVatsimEventCheckerService();
