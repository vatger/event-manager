import { prisma } from "@/lib/prisma";
import { DiscordNotificationType } from "./notificationTypes";

export interface DiscordChannelConfig {
  channelId: string;
  roleId?: string | null;
}

/**
 * Resolve the Discord channel/role for a given notification type.
 * Lookup priority:
 *   1. Weekly-specific config (firId + type + weeklyConfigId)
 *   2. FIR-wide config for this type (firId + type + weeklyConfigId=null)
 *   3. Env var fallback for backward compatibility (EDMM only)
 */
export async function resolveDiscordConfig(
  firId: number,
  firCode: string,
  notificationType: DiscordNotificationType,
  weeklyConfigId?: number
): Promise<DiscordChannelConfig | null> {
  // 1. Weekly-specific config
  if (weeklyConfigId != null) {
    const specific = await prisma.firDiscordNotification.findFirst({
      where: { firId, notificationType, weeklyConfigId },
    });
    if (specific) return { channelId: specific.channelId, roleId: specific.roleId };
  }

  // 2. FIR-wide config for this type
  const firWide = await prisma.firDiscordNotification.findFirst({
    where: { firId, notificationType, weeklyConfigId: null },
  });
  if (firWide) return { channelId: firWide.channelId, roleId: firWide.roleId };

  // 3. Backward compat env var fallback (EDMM weekly_signup_deadline only)
  if (firCode === "EDMM" && notificationType === "weekly_signup_deadline") {
    const channelId = process.env.DISCORD_EDMM_CHANNEL_ID;
    const roleId = process.env.DISCORD_EDMM_ROLE_ID;
    if (channelId) return { channelId, roleId };
  }

  return null;
}
