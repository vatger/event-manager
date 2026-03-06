/**
 * Discord notification types for FIR-level Discord notifications.
 * Each type can have different channel + role configured per FIR.
 * Weekly-specific configs (weeklyConfigId set) take precedence over FIR-wide configs (weeklyConfigId null).
 */
export const DISCORD_NOTIFICATION_TYPES = {
  /** Sent when the signup deadline for a weekly event passes */
  WEEKLY_SIGNUP_DEADLINE: "weekly_signup_deadline",
  /** Sent when a roster is published for a weekly event */
  ROSTER_PUBLISHED: "roster_published",
  /** Sent for CPT (Competency/Training) related notifications */
  CPT_NOTIFICATION: "cpt_notification",
} as const;

export type DiscordNotificationType =
  (typeof DISCORD_NOTIFICATION_TYPES)[keyof typeof DISCORD_NOTIFICATION_TYPES];

export const DISCORD_NOTIFICATION_LABELS: Record<DiscordNotificationType, string> = {
  weekly_signup_deadline: "Anmeldeschluss (Weekly)",
  roster_published: "Roster veröffentlicht",
  cpt_notification: "CPT Benachrichtigung",
};
