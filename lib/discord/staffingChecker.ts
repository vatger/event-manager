import { prisma } from "@/lib/prisma";
import { vatsimService } from "@/discord-bot/services/vatsim.service";
import { startOfDay, isSameDay } from "date-fns";
import { getRequiredStaffing } from "@/discord-bot/config/weeklyEvents.config";

export interface StaffingCheckResult {
  configId: number;
  configName: string;
  date: Date;
  requirements: {
    regex: string;
    required: number;
    booked: number;
    sufficient: boolean;
  }[];
  overallSufficient: boolean;
  shouldNotify: boolean;
}

/**
 * Service for checking staffing requirements for weekly events
 */
export class StaffingCheckerService {
  /**
   * Check staffing for all weekly events happening today
   */
  async checkTodayStaffing(): Promise<StaffingCheckResult[]> {
    const today = startOfDay(new Date());

    const occurrences = await prisma!.weeklyEventOccurrence.findMany({
      where: {
        date: today,
      },
      include: {
        config: true,
      },
    });

    // Fetch data once for all checks
    const events = await vatsimService.getEvents();
    const bookings = await vatsimService.getBookings();
    
    const results: StaffingCheckResult[] = [];

    for (const occurrence of occurrences) {
      if (!occurrence.config.enabled) {
        continue;
      }

      // Get required staffing from config file instead of database
      const requiredStaffing = getRequiredStaffing(occurrence.config.name);
      
      // Skip if no staffing requirements defined
      if (Object.keys(requiredStaffing).length === 0) {
        continue;
      }

      const staffingResult = this.checkStaffingForEvent(
        occurrence.config.id,
        occurrence.config.name,
        occurrence.date,
        requiredStaffing,
        events,
        bookings
      );

      // Update occurrence record
      await prisma!.weeklyEventOccurrence.update({
        where: { id: occurrence.id },
        data: {
          staffingChecked: true,
          staffingSufficient: staffingResult.overallSufficient,
        },
      });

      results.push(staffingResult);
    }

    return results;
  }

  /**
   * Check staffing for a specific event
   * Now accepts pre-fetched events and bookings to avoid redundant API calls
   */
  private checkStaffingForEvent(
    configId: number,
    configName: string,
    eventDate: Date,
    requiredStaffing: Record<string, number>,
    events: Awaited<ReturnType<typeof vatsimService.getEvents>>,
    bookings: Awaited<ReturnType<typeof vatsimService.getBookings>>
  ): StaffingCheckResult {
    const matchingEvent = events.find((e) => {
      const eventStartDate = new Date(e.start_time);
      const nameMatch =
        e.name.toLowerCase().includes(configName.toLowerCase()) ||
        configName.toLowerCase().includes(e.name.toLowerCase());
      const dateMatch = isSameDay(eventStartDate, eventDate);
      return nameMatch && dateMatch;
    });

    if (!matchingEvent) {
      // Event not found in myVATSIM - can't check staffing
      return {
        configId,
        configName,
        date: eventDate,
        requirements: [],
        overallSufficient: false,
        shouldNotify: true,
      };
    }

    // Filter bookings that overlap with the event time
    const eventStart = new Date(matchingEvent.start_time);
    const eventEnd = new Date(matchingEvent.end_time);
    
    const relevantBookings = bookings.filter((booking) => {
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      // Check if booking overlaps with event
      return bookingStart < eventEnd && bookingEnd > eventStart;
    });

    // Check each staffing requirement
    const requirements = Object.entries(requiredStaffing).map(
      ([regex, required]) => {
        const pattern = new RegExp(regex, "i");
        const booked = relevantBookings.filter((b) =>
          pattern.test(b.callsign)
        ).length;

        return {
          regex,
          required,
          booked,
          sufficient: booked >= required,
        };
      }
    );

    const overallSufficient = requirements.every((r) => r.sufficient);

    return {
      configId,
      configName,
      date: eventDate,
      requirements,
      overallSufficient,
      shouldNotify: !overallSufficient,
    };
  }

  /**
   * Get staffing issues that need notification
   */
  async getStaffingIssuesForNotification(): Promise<StaffingCheckResult[]> {
    const results = await this.checkTodayStaffing();
    return results.filter((r) => r.shouldNotify);
  }
}

export const staffingChecker = new StaffingCheckerService();
