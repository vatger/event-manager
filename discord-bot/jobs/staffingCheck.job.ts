import { ChannelType, EmbedBuilder } from "discord.js";
import { client } from "../client";
import { staffingChecker } from "@/lib/discord/staffingChecker";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getDiscordChannelId, getDiscordRoleId, getEmbedConfig, replaceEmbedVariables } from "../config/weeklyEvents.config";

/**
 * Job to check staffing requirements for today's weekly events
 * Sends notifications to Discord when minimum staffing is not met
 */
export async function runStaffingCheck() {
  console.log("[Staffing Check] Starting staffing check for today's events...");

  try {
    const staffingIssues = await staffingChecker.getStaffingIssuesForNotification();

    for (const issue of staffingIssues) {
      // Get Discord channel from config file instead of database
      const channelId = getDiscordChannelId(issue.configName);
      
      if (!channelId) {
        console.log(
          `[Staffing Check] No Discord channel configured for ${issue.configName}`
        );
        continue;
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.log(
          `[Staffing Check] Invalid channel for ${issue.configName}`
        );
        continue;
      }

      // Build the staffing details
      const staffingDetails = issue.requirements
        .map((req) => {
          const icon = req.sufficient ? "✅" : "❌";
          return `${icon} ${req.regex}: ${req.booked}/${req.required}`;
        })
        .join("\n");

      // Get embed configuration based on staffing status
      const embedType = issue.overallSufficient ? 'staffingSufficient' : 'staffingInsufficient';
      const embedConfig = getEmbedConfig(issue.configName, embedType);
      const formattedDate = format(issue.date, "EEEE, dd.MM.yyyy", { locale: de });

      const embed = new EmbedBuilder()
        .setColor(embedConfig.color ?? (issue.overallSufficient ? 0x00ff00 : 0xff9900))
        .setTitle(replaceEmbedVariables(embedConfig.title, {
          eventName: issue.configName,
          date: formattedDate,
        }))
        .setDescription(replaceEmbedVariables(embedConfig.description, {
          eventName: issue.configName,
          date: formattedDate,
        }))
        .addFields({
          name: "Besetzung",
          value: staffingDetails || "Keine Anforderungen definiert",
        })
        .setTimestamp();
      
      if (embedConfig.footer) {
        embed.setFooter({ text: embedConfig.footer });
      }

      // Only send notification if staffing is insufficient
      if (!issue.overallSufficient) {
        // Get Discord role from config file instead of database
        const roleId = getDiscordRoleId(issue.configName);
        const mention = roleId ? `<@&${roleId}>` : "";

        await channel.send({
          content: mention,
          embeds: [embed],
        });

        console.log(
          `[Staffing Check] Sent notification for ${issue.configName}`
        );
      }
    }

    console.log(
      `[Staffing Check] Completed. Issues found: ${staffingIssues.length}`
    );

    return {
      issuesFound: staffingIssues.length,
    };
  } catch (error) {
    console.error("[Staffing Check] Error:", error);
    throw error;
  }
}
