import { format } from "date-fns";
import { de } from "date-fns/locale";

export interface WeeklyEventOccurrence {
  id: number;
  date: string | Date;
  config: {
    id: number;
    name: string;
    weekday: number;
    weeksOn: number;
    weeksOff: number;
    startDate: string | Date;
  };
}

export interface FormattedDateEntry {
  type: "event" | "pause";
  date?: Date;
  formattedDate?: string;
  label: string;
}

/**
 * Formats weekly event occurrences with pause indicators
 * 
 * @param occurrences - Array of weekly event occurrences
 * @returns Array of formatted date entries including pause indicators
 */
export function formatWeeklyEventsWithPauses(
  occurrences: WeeklyEventOccurrence[]
): FormattedDateEntry[] {
  if (occurrences.length === 0) return [];

  const result: FormattedDateEntry[] = [];
  const config = occurrences[0].config;
  
  // If no pause weeks configured, just return the dates
  if (config.weeksOff === 0) {
    return occurrences.map((occ) => {
      const date = new Date(occ.date);
      return {
        type: "event" as const,
        date,
        formattedDate: format(date, "dd.MM.yyyy", { locale: de }),
        label: format(date, "dd.MM.yyyy", { locale: de }),
      };
    });
  }

  // Track which week we're in within the pattern cycle
  let weekInCycle = 0;
  let lastDate: Date | null = null;

  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i];
    const currentDate = new Date(occ.date);

    // Add the event date
    result.push({
      type: "event",
      date: currentDate,
      formattedDate: format(currentDate, "dd.MM.yyyy", { locale: de }),
      label: format(currentDate, "dd.MM.yyyy", { locale: de }),
    });

    weekInCycle++;

    // Check if we need to add pause indicators
    if (weekInCycle >= config.weeksOn && i < occurrences.length - 1) {
      const nextOcc = occurrences[i + 1];
      const nextDate = new Date(nextOcc.date);
      
      // Calculate expected weeks between current and next occurrence
      const weeksBetween = Math.round(
        (nextDate.getTime() - currentDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

      // If there's a gap larger than 1 week, it's a pause period
      if (weeksBetween > 1) {
        // Add pause indicator(s) for the gap weeks
        const pauseWeeks = weeksBetween - 1;
        for (let p = 0; p < pauseWeeks && p < config.weeksOff; p++) {
          result.push({
            type: "pause",
            label: "PAUSE",
          });
        }
        weekInCycle = 0; // Reset cycle after pause
      }
    }

    // Reset cycle when reaching the pattern length
    if (weekInCycle >= config.weeksOn) {
      weekInCycle = 0;
    }

    lastDate = currentDate;
  }

  return result;
}

/**
 * Formats a single weekly event's occurrences for display
 * Returns a string with dates and pause indicators
 */
export function formatWeeklyEventsList(
  occurrences: WeeklyEventOccurrence[]
): string {
  const formatted = formatWeeklyEventsWithPauses(occurrences);
  return formatted.map((entry) => entry.label).join("\n");
}
