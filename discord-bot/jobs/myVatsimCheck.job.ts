import { ChannelType, EmbedBuilder } from "discord.js";
import { client } from "../client";
import { myVatsimEventChecker } from "@/lib/discord/myVatsimEventChecker";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { discordBotConfig, getDiscordChannelId, getDiscordRoleId, getEmbedConfig, replaceEmbedVariables } from "../config/weeklyEvents.config";

/**
 * Job to check if weekly and irregular events are registered in myVATSIM
 * Sends notifications to Discord channels when events are not registered
 */
export async function runMyVatsimEventCheck() {
  console.log("[myVATSIM Check] Starting event registration check...");

  try {
    // Check weekly events
    const weeklyIssues = await myVatsimEventChecker.getWeeklyEventsNeedingNotification();
    
    // Check irregular events from event manager
    const irregularIssues = await myVatsimEventChecker.getIrregularEventsNeedingNotification();

    // Send notifications for weekly events
    for (const issue of weeklyIssues) {
      // Get Discord channel from config file instead of database
      const channelId = getDiscordChannelId(issue.configName);
      
      if (!channelId) {
        console.log(
          `[myVATSIM Check] No Discord channel configured for ${issue.configName}`
        );
        continue;
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.log(
          `[myVATSIM Check] Invalid channel for ${issue.configName}`
        );
        continue;
      }

      // Get embed configuration
      const embedConfig = getEmbedConfig(issue.configName, 'myVatsimMissing');
      const formattedDate = format(issue.date, "dd.MM.yyyy", { locale: de });

      const embed = new EmbedBuilder()
        .setColor(embedConfig.color ?? 0xff0000)
        .setTitle(replaceEmbedVariables(embedConfig.title, {
          eventName: issue.configName,
          date: formattedDate,
          daysUntil: issue.daysUntilEvent,
        }))
        .setDescription(replaceEmbedVariables(embedConfig.description, {
          eventName: issue.configName,
          date: formattedDate,
          daysUntil: issue.daysUntilEvent,
        }))
        .addFields(
          {
            name: "Event",
            value: issue.configName,
            inline: true,
          },
          {
            name: "Datum",
            value: format(issue.date, "EEEE, dd.MM.yyyy", { locale: de }),
            inline: true,
          },
          {
            name: "Tage bis zum Event",
            value: `${issue.daysUntilEvent} Tage`,
            inline: true,
          }
        )
        .setTimestamp();
      
      if (embedConfig.footer) {
        embed.setFooter({ text: embedConfig.footer });
      }

      // Get Discord role from config file instead of database
      const roleId = getDiscordRoleId(issue.configName);
      const mention = roleId ? `<@&${roleId}>` : "";

      await channel.send({
        content: mention,
        embeds: [embed],
      });

      console.log(
        `[myVATSIM Check] Sent notification for ${issue.configName}`
      );
    }

    // Send notifications for irregular events
    for (const issue of irregularIssues) {
      // Use default irregular event configuration from config file
      if (!discordBotConfig.defaultIrregularEventConfig) {
        console.log(
          `[myVATSIM Check] No default irregular event configuration found in config file`
        );
        continue;
      }

      const channelId = discordBotConfig.defaultIrregularEventConfig.channelId;
      
      if (!channelId) {
        console.log(
          `[myVATSIM Check] No Discord channel configured for irregular events`
        );
        continue;
      }

      const channel = await client.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.log(
          `[myVATSIM Check] Invalid channel for irregular events`
        );
        continue;
      }

      // Get embed configuration
      const embedConfig = getEmbedConfig(issue.eventName, 'myVatsimMissing');
      const formattedDate = format(issue.date, "dd.MM.yyyy", { locale: de });

      const embed = new EmbedBuilder()
        .setColor(embedConfig.color ?? 0xff0000)
        .setTitle(replaceEmbedVariables(embedConfig.title, {
          eventName: issue.eventName,
          date: formattedDate,
          daysUntil: issue.daysUntilEvent,
        }))
        .setDescription(replaceEmbedVariables(embedConfig.description, {
          eventName: issue.eventName,
          date: formattedDate,
          daysUntil: issue.daysUntilEvent,
        }))
        .addFields(
          {
            name: "Event",
            value: issue.eventName,
            inline: true,
          },
          {
            name: "FIR",
            value: issue.firCode || "N/A",
            inline: true,
          },
          {
            name: "Datum",
            value: format(issue.date, "EEEE, dd.MM.yyyy", { locale: de }),
            inline: true,
          },
          {
            name: "Tage bis zum Event",
            value: `${issue.daysUntilEvent} Tage`,
            inline: true,
          }
        )
        .setTimestamp();
      
      if (embedConfig.footer) {
        embed.setFooter({ text: embedConfig.footer });
      }

      // Get Discord role from config file
      const roleId = discordBotConfig.defaultIrregularEventConfig.roleId;
      const mention = roleId ? `<@&${roleId}>` : "";

      await channel.send({
        content: mention,
        embeds: [embed],
      });

      console.log(
        `[myVATSIM Check] Sent notification for ${issue.eventName}`
      );
    }

    console.log(
      `[myVATSIM Check] Completed. Weekly issues: ${weeklyIssues.length}, Irregular issues: ${irregularIssues.length}`
    );

    return {
      weeklyIssues: weeklyIssues.length,
      irregularIssues: irregularIssues.length,
    };
  } catch (error) {
    console.error("[myVATSIM Check] Error:", error);
    throw error;
  }
}
