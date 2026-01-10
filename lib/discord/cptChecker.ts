import axios from "axios";
import { startOfDay, addDays, parseISO, format } from "date-fns";

export interface CPTData {
  id: number;
  trainee_vatsim_id: number;
  trainee_name: string;
  examiner_vatsim_id: number;
  examiner_name: string;
  local_vatsim_id: number;
  local_name: string;
  course_name: string;
  position: string;
  date: string; // ISO 8601 format
  confirmed: boolean;
}

export interface CPTForNotification {
  id: number;
  trainee_name: string;
  examiner_name: string;
  position: string;
  date: Date;
  time: string; // e.g., "20:00"
  confirmed: boolean;
}

/**
 * CPT Checker Service
 * Fetches CPT data from Training API and filters for notifications
 */
class CPTChecker {
  /**
   * Fetch all CPTs from the Training API
   */
  private async fetchCPTs(): Promise<CPTData[]> {
    const apiUrl = process.env.TRAINING_API_CPTS_URL;
    const token = process.env.TRAINING_API_TOKEN;

    if (!apiUrl) {
      console.warn("[CPT Checker] TRAINING_API_CPTS_URL not configured, skipping CPT check");
      return [];
    }

    if (!token) {
      console.warn("[CPT Checker] TRAINING_API_TOKEN not configured, skipping CPT check");
      return [];
    }

    try {
      const response = await axios.get<{ data: CPTData[] }>(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data.data || [];
    } catch (error) {
      console.error("[CPT Checker] Error fetching CPTs:", error);
      return [];
    }
  }

  /**
   * Filter CPTs by position patterns
   */
  private matchesPositionFilter(position: string, filters: string[]): boolean {
    if (!filters || filters.length === 0) {
      return true; // No filters means all positions
    }

    return filters.some((filter) => {
      try {
        const regex = new RegExp(filter);
        return regex.test(position);
      } catch (error) {
        console.error(`[CPT Checker] Invalid regex pattern: ${filter}`, error);
        return false;
      }
    });
  }

  /**
   * Get CPTs for a specific date
   */
  async getCPTsForDate(
    targetDate: Date,
    positionFilters?: string[]
  ): Promise<CPTForNotification[]> {
    const allCPTs = await this.fetchCPTs();

    const targetDateStart = startOfDay(targetDate);
    const targetDateEnd = addDays(targetDateStart, 1);

    const filteredCPTs = allCPTs.filter((cpt) => {
      // Parse the date
      const cptDate = parseISO(cpt.date);

      // Check if it's on the target date
      if (cptDate < targetDateStart || cptDate >= targetDateEnd) {
        return false;
      }

      // Check if position matches filters
      if (positionFilters && !this.matchesPositionFilter(cpt.position, positionFilters)) {
        return false;
      }

      return true;
    });

    return filteredCPTs.map((cpt) => {
      const cptDate = parseISO(cpt.date);
      const time = format(cptDate, "HH:mm");

      return {
        id: cpt.id,
        trainee_name: cpt.trainee_name,
        examiner_name: cpt.examiner_name,
        position: cpt.position,
        date: cptDate,
        time,
        confirmed: cpt.confirmed,
      };
    });
  }

  /**
   * Get CPTs scheduled for today
   */
  async getCPTsForToday(positionFilters?: string[]): Promise<CPTForNotification[]> {
    const today = new Date();
    return this.getCPTsForDate(today, positionFilters);
  }

  /**
   * Get CPTs scheduled N days from now
   */
  async getCPTsInDays(
    daysAhead: number,
    positionFilters?: string[]
  ): Promise<CPTForNotification[]> {
    const targetDate = addDays(new Date(), daysAhead);
    return this.getCPTsForDate(targetDate, positionFilters);
  }
}

export const cptChecker = new CPTChecker();
