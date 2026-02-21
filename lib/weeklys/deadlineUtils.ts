/**
 * Utility functions for weekly event deadline calculations
 */

/**
 * Calculate the signup deadline for a weekly event occurrence
 * Takes into account the event's start time in local timezone (Europe/Berlin)
 * 
 * @param occurrenceDate - The date of the occurrence (just the date part)
 * @param startTime - The start time in HH:mm format (local time)
 * @param deadlineHours - Hours before the event when signup closes
 * @returns The calculated deadline as a Date object, or null if no deadline
 */
export function calculateSignupDeadline(
  occurrenceDate: Date,
  startTime: string | null,
  deadlineHours: number | null
): Date | null {
  if (!deadlineHours) {
    return null;
  }

  // Parse the start time (HH:mm format, Europe/Berlin timezone)
  let eventDateTime = new Date(occurrenceDate);
  
  if (startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    eventDateTime.setHours(hours, minutes, 0, 0);
  } else {
    // If no start time specified, assume event starts at midnight
    eventDateTime.setHours(0, 0, 0, 0);
  }

  // Calculate deadline by subtracting hours
  const deadline = new Date(eventDateTime.getTime() - deadlineHours * 60 * 60 * 1000);
  
  return deadline;
}

/**
 * Format a date to Europe/Berlin timezone for display
 */
export function formatDateTimeLocal(date: Date): string {
  return date.toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
