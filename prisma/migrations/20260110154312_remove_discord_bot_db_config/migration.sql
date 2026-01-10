-- Drop Discord bot configuration table and unused fields from WeeklyEventConfiguration
-- All Discord configuration is now file-based in discord-bot/config/weeklyEvents.config.ts

-- Drop obsolete table
DROP TABLE IF EXISTS `DiscordBotConfiguration`;

-- Remove Discord-related fields from WeeklyEventConfiguration
ALTER TABLE `WeeklyEventConfiguration` DROP COLUMN IF EXISTS `checkDaysAhead`;
ALTER TABLE `WeeklyEventConfiguration` DROP COLUMN IF EXISTS `discordChannelId`;
ALTER TABLE `WeeklyEventConfiguration` DROP COLUMN IF EXISTS `discordRoleId`;
ALTER TABLE `WeeklyEventConfiguration` DROP COLUMN IF EXISTS `requiredStaffing`;
