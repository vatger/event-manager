/**
 * Utility functions for export layouts
 */

/**
 * Format date in German format (DD.MM.YYYY)
 */
export function formatDateGerman(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Reference date for availability checking
 * This is used as a base date for time comparisons in availability slots
 */
export const AVAILABILITY_REFERENCE_DATE = '2025-09-29';

/**
 * Check if a user is available for a specific timeslot
 */
export function isUserAvailable(
  user: { availability: { available: Array<{ start: string; end: string }> } },
  timeslot: string
): boolean {
  const [slotStart] = timeslot.split('\n');
  const slotTimeFormatted = `${slotStart.substring(0, 2)}:${slotStart.substring(2, 4)}`;
  const slotTime = new Date(`${AVAILABILITY_REFERENCE_DATE}T${slotTimeFormatted}:00.000Z`);
  
  for (const avail of user.availability.available) {
    const availStart = new Date(`${AVAILABILITY_REFERENCE_DATE}T${avail.start}:00.000Z`);
    const availEnd = new Date(`${AVAILABILITY_REFERENCE_DATE}T${avail.end}:00.000Z`);
    
    if (slotTime >= availStart && slotTime < availEnd) {
      return true;
    }
  }
  return false;
}
