/**
 * Simple deadline check that triggers Discord notifications
 * when signup deadlines pass for EDMM events.
 * 
 * No cron needed - runs on-demand when checking signup status.
 */

import { sendSignupDeadlineDiscordNotification } from "./notificationService";

// In-memory cache to track which occurrences already had notification sent
// Key: occurrenceId, Value: timestamp when notification was sent
const notificationCache = new Map<number, number>();

// Cache TTL: 7 days (in milliseconds)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Check if Discord notification should be sent for an occurrence
 * that just passed its signup deadline.
 * 
 * This should be called when:
 * - Admin accesses occurrence management
 * - Occurrence page is loaded
 * - Any time signup status is checked
 * 
 * @param occurrenceId - ID of the occurrence
 * @param configId - ID of the weekly config
 * @param signupDeadline - The signup deadline date
 * @param firCode - FIR code (e.g., "EDMM")
 * @param rosterPublished - Whether roster is already published
 */
export async function checkAndNotifyDeadline(
  occurrenceId: number,
  configId: number,
  signupDeadline: Date | null,
  firCode: string,
  rosterPublished: boolean
): Promise<void> {
  // Only for EDMM
  if (firCode !== "EDMM") {
    return;
  }

  // Don't send if roster already published
  if (rosterPublished) {
    return;
  }

  // No deadline set
  if (!signupDeadline) {
    return;
  }

  // Check if deadline has passed
  const now = new Date();
  if (now < signupDeadline) {
    return; // Deadline not reached yet
  }

  // Check if notification already sent (from cache)
  const cachedTime = notificationCache.get(occurrenceId);
  if (cachedTime) {
    // Check if cache entry is still valid
    if (now.getTime() - cachedTime < CACHE_TTL) {
      return; // Already notified recently
    }
    // Cache expired, remove entry
    notificationCache.delete(occurrenceId);
  }

  // Check if deadline passed recently (within last 24 hours)
  // This prevents sending notifications for very old occurrences
  const hoursSinceDeadline = (now.getTime() - signupDeadline.getTime()) / (1000 * 60 * 60);
  if (hoursSinceDeadline > 24) {
    // Deadline was more than 24 hours ago, don't send notification
    // But mark as "sent" to prevent future checks
    notificationCache.set(occurrenceId, now.getTime());
    return;
  }

  try {
    // Send Discord notification
    console.log(`[DEADLINE CHECK] Sending Discord notification for occurrence ${occurrenceId}`);
    await sendSignupDeadlineDiscordNotification(occurrenceId, configId);
    
    // Mark as sent in cache
    notificationCache.set(occurrenceId, now.getTime());
    console.log(`[DEADLINE CHECK] Discord notification sent for occurrence ${occurrenceId}`);
  } catch (error) {
    console.error(`[DEADLINE CHECK] Failed to send Discord notification for occurrence ${occurrenceId}:`, error);
    // Don't cache on error - will retry next time
  }
}

/**
 * Clear notification cache (useful for testing)
 */
export function clearNotificationCache(): void {
  notificationCache.clear();
}

/**
 * Clean up old cache entries (run periodically if needed)
 */
export function cleanupNotificationCache(): void {
  const now = new Date().getTime();
  for (const [occurrenceId, timestamp] of notificationCache.entries()) {
    if (now - timestamp > CACHE_TTL) {
      notificationCache.delete(occurrenceId);
    }
  }
}
