/**
 * Discord Notification Configuration
 *
 * Defines which Discord channels and roles are used for different notification types
 * and optionally for specific weekly events.
 *
 * Lookup priority for each notification:
 *   1. Entry matching (firCode + notificationType + weeklyConfigId)  ← most specific
 *   2. Entry matching (firCode + notificationType) with no weeklyConfigId  ← FIR-wide fallback
 *
 * Non-sensitive IDs (channel IDs, role IDs) live here.
 * Sensitive credentials (DISCORD_BOT_TOKEN) remain in environment variables.
 * The bot URL (DISCORD_BOT_URL) also stays in env vars as it may differ between deployments.
 *
 * Notification types:
 *   "weekly_signup_deadline" — sent when the signup deadline for a weekly event passes
 *   "roster_published"       — sent when a roster is published for a weekly event
 *   "staffing_check"         — sent by the staffing check cron job
 *   "my_vatsim_check"        — sent by the myVATSIM check cron job
 */

export type DiscordNotificationType =
  | "weekly_signup_deadline"
  | "roster_published"
  | "staffing_check"
  | "my_vatsim_check";

export interface DiscordNotificationEntry {
  /** FIR code this entry applies to (e.g. "EDMM", "EDGG") */
  firCode: string;
  /** Notification type this entry handles */
  notificationType: DiscordNotificationType;
  /** Optional: ID of the WeeklyEventConfiguration this applies to. Omit for FIR-wide fallback. */
  weeklyConfigId?: number;
  /** Discord channel ID to post the notification in */
  channelId: string;
  /** Optional: Discord role ID to mention */
  roleId?: string;
  /** Optional: human-readable label for documentation */
  label?: string;
}

/**
 * Add entries here to configure Discord notifications.
 *
 * Example — all weekly deadline + staffing notifications for EDMM go to one channel:
 *
 *   { firCode: "EDMM", notificationType: "weekly_signup_deadline", channelId: "1234...", roleId: "5678..." },
 *   { firCode: "EDMM", notificationType: "staffing_check",         channelId: "1234...", roleId: "5678..." },
 *
 * Example — override for one specific weekly (weeklyConfigId: 3):
 *
 *   { firCode: "EDMM", notificationType: "weekly_signup_deadline", weeklyConfigId: 3, channelId: "9999...", roleId: "1111..." },
 */
export const DISCORD_NOTIFICATIONS: DiscordNotificationEntry[] = [
  // ---------------------------------------------------------------------------
  // EDMM (München)
  // ---------------------------------------------------------------------------
  // {
  //   firCode: "EDMM",
  //   notificationType: "weekly_signup_deadline",
  //   channelId: "YOUR_CHANNEL_ID",
  //   roleId: "YOUR_ROLE_ID",
  //   label: "EDMM Weekly Anmeldeschluss",
  // },
  // {
  //   firCode: "EDMM",
  //   notificationType: "roster_published",
  //   channelId: "YOUR_CHANNEL_ID",
  //   roleId: "YOUR_ROLE_ID",
  //   label: "EDMM Roster veröffentlicht",
  // },
  // {
  //   firCode: "EDMM",
  //   notificationType: "staffing_check",
  //   channelId: "YOUR_CHANNEL_ID",
  //   roleId: "YOUR_ROLE_ID",
  //   label: "EDMM Staffing Check",
  // },
  // {
  //   firCode: "EDMM",
  //   notificationType: "my_vatsim_check",
  //   channelId: "YOUR_CHANNEL_ID",
  //   roleId: "YOUR_ROLE_ID",
  //   label: "EDMM myVATSIM Check",
  // },
];

/**
 * Resolve the Discord channel/role for a given notification.
 *
 * @param firCode  FIR code of the event
 * @param type     Notification type
 * @param weeklyConfigId  Optional weekly config ID for a more specific lookup
 * @returns  { channelId, roleId } or null if no config found
 */
export function resolveDiscordNotification(
  firCode: string,
  type: DiscordNotificationType,
  weeklyConfigId?: number
): { channelId: string; roleId?: string } | null {
  // 1. Weekly-specific config
  if (weeklyConfigId != null) {
    const specific = DISCORD_NOTIFICATIONS.find(
      (e) => e.firCode === firCode && e.notificationType === type && e.weeklyConfigId === weeklyConfigId
    );
    if (specific) return { channelId: specific.channelId, roleId: specific.roleId };
  }

  // 2. FIR-wide config for this type (no weeklyConfigId)
  const firWide = DISCORD_NOTIFICATIONS.find(
    (e) => e.firCode === firCode && e.notificationType === type && e.weeklyConfigId === null
  );
  if (firWide) return { channelId: firWide.channelId, roleId: firWide.roleId };

  return null;
}
