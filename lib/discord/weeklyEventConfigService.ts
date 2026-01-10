import { prisma } from "@/lib/prisma";
import {
  WeeklyEventConfigurationCreate,
  WeeklyEventConfigurationUpdate,
} from "@/types/weeklyEvent";
import { addDays, addWeeks, startOfDay, isBefore, isAfter } from "date-fns";

/**
 * Service for managing weekly event configurations
 */
export class WeeklyEventConfigurationService {
  /**
   * Create a new weekly event configuration
   */
  async create(data: WeeklyEventConfigurationCreate) {
    const config = await prisma!.weeklyEventConfiguration.create({
      data: {
        firId: data.firId,
        name: data.name,
        weekday: data.weekday,
        weeksOn: data.weeksOn,
        weeksOff: data.weeksOff,
        startDate: new Date(data.startDate),
        enabled: data.enabled ?? true,
      },
      include: {
        fir: true,
      },
    });

    // Generate initial occurrences for the next 6 months
    await this.generateOccurrences(config.id, 6);

    return config;
  }

  /**
   * Get all weekly event configurations, optionally filtered by FIR
   */
  async getAll(firId?: number) {
    return prisma!.weeklyEventConfiguration.findMany({
      where: firId ? { firId } : undefined,
      include: {
        fir: true,
        occurrences: {
          where: {
            date: {
              gte: new Date(),
            },
          },
          orderBy: {
            date: "asc",
          },
          take: 10, // Next 10 occurrences
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  /**
   * Get a single weekly event configuration by ID
   */
  async getById(id: number) {
    return prisma!.weeklyEventConfiguration.findUnique({
      where: { id },
      include: {
        fir: true,
        occurrences: {
          where: {
            date: {
              gte: new Date(),
            },
          },
          orderBy: {
            date: "asc",
          },
        },
      },
    });
  }

  /**
   * Update a weekly event configuration
   */
  async update(id: number, data: WeeklyEventConfigurationUpdate) {
    const config = await prisma!.weeklyEventConfiguration.update({
      where: { id },
      data: {
        name: data.name,
        weekday: data.weekday,
        weeksOn: data.weeksOn,
        weeksOff: data.weeksOff,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        enabled: data.enabled,
      },
      include: {
        fir: true,
      },
    });

    // If pattern changed, regenerate future occurrences
    if (
      data.weeksOn !== undefined ||
      data.weeksOff !== undefined ||
      data.weekday !== undefined ||
      data.startDate !== undefined
    ) {
      await this.regenerateFutureOccurrences(id);
    }

    return config;
  }

  /**
   * Delete a weekly event configuration
   */
  async delete(id: number) {
    // Cascading delete will handle occurrences
    return prisma!.weeklyEventConfiguration.delete({
      where: { id },
    });
  }

  /**
   * Generate occurrences for a weekly event configuration
   * @param configId - The configuration ID
   * @param monthsAhead - How many months ahead to generate (default: 6)
   */
  async generateOccurrences(configId: number, monthsAhead = 6) {
    const config = await prisma!.weeklyEventConfiguration.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new Error(`Configuration ${configId} not found`);
    }

    const occurrences = this.calculateOccurrences(
      config.startDate,
      config.weekday,
      config.weeksOn,
      config.weeksOff,
      monthsAhead
    );

    // Insert occurrences that don't already exist
    for (const date of occurrences) {
      await prisma!.weeklyEventOccurrence.upsert({
        where: {
          configId_date: {
            configId,
            date: startOfDay(date),
          },
        },
        create: {
          configId,
          date: startOfDay(date),
        },
        update: {
          // Keep existing data if occurrence already exists
        },
      });
    }
  }

  /**
   * Regenerate future occurrences (delete future ones and regenerate)
   */
  async regenerateFutureOccurrences(configId: number) {
    // Delete future occurrences
    await prisma!.weeklyEventOccurrence.deleteMany({
      where: {
        configId,
        date: {
          gte: startOfDay(new Date()),
        },
      },
    });

    // Generate new ones
    await this.generateOccurrences(configId, 6);
  }

  /**
   * Calculate occurrence dates based on pattern
   * @param startDate - When the pattern starts
   * @param weekday - Day of week (0-6)
   * @param weeksOn - Number of consecutive weeks event occurs
   * @param weeksOff - Number of weeks off after the "on" period
   * @param monthsAhead - How many months to calculate
   */
  private calculateOccurrences(
    startDate: Date,
    weekday: number,
    weeksOn: number,
    weeksOff: number,
    monthsAhead: number
  ): Date[] {
    const occurrences: Date[] = [];
    const endDate = addWeeks(new Date(), monthsAhead * 4); // Approximate months to weeks
    
    // Find the first occurrence on or after startDate that matches the weekday
    let currentDate = startOfDay(startDate);
    const dayDiff = (weekday - currentDate.getDay() + 7) % 7;
    currentDate = addDays(currentDate, dayDiff);

    let weekInCycle = 0;
    const cycleLength = weeksOn + weeksOff;

    while (!isAfter(currentDate, endDate)) {
      // Check if we're in an "on" week of the cycle
      if (weekInCycle < weeksOn) {
        // Only add if it's on or after the start date
        if (!isBefore(currentDate, startDate)) {
          occurrences.push(new Date(currentDate));
        }
      }

      // Move to next week
      currentDate = addWeeks(currentDate, 1);
      weekInCycle = (weekInCycle + 1) % cycleLength;
    }

    return occurrences;
  }

  /**
   * Get occurrences for a configuration within a date range
   */
  async getOccurrences(
    configId: number,
    startDate?: Date,
    endDate?: Date
  ) {
    return prisma!.weeklyEventOccurrence.findMany({
      where: {
        configId,
        date: {
          gte: startDate || new Date(),
          lte: endDate,
        },
      },
      orderBy: {
        date: "asc",
      },
    });
  }
}

export const weeklyEventConfigService = new WeeklyEventConfigurationService();
