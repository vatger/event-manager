import { ChannelType, EmbedBuilder } from "discord.js";
import { client } from "../client";
import { myVatsimEventChecker } from "@/lib/discord/myVatsimEventChecker";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/prisma";

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
      const config = await prisma!.weeklyEventConfiguration.findUnique({
        where: { id: issue.configId },
        include: { fir: true },
      });

      if (!config || !config.discordChannelId) {
        console.log(
          `[myVATSIM Check] No Discord channel configured for ${issue.configName}`
        );
        continue;
      }

      const channel = await client.channels.fetch(config.discordChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.log(
          `[myVATSIM Check] Invalid channel for ${issue.configName}`
        );
        continue;
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Event nicht in myVATSIM eingetragen")
        .setDescription(
          `**${issue.configName}** ist noch nicht für den ${format(
            issue.date,
            "dd.MM.yyyy",
            { locale: de }
          )} in myVATSIM eingetragen.`
        )
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

      const roleId = config.discordRoleId;
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
      // Get the FIR's Discord configuration
      if (!issue.firCode) continue;

      const firConfig = await prisma!.discordBotConfiguration.findFirst({
        where: {
          fir: {
            code: issue.firCode,
          },
        },
        include: { fir: true },
      });

      if (!firConfig || !firConfig.defaultChannelId) {
        console.log(
          `[myVATSIM Check] No Discord channel configured for FIR ${issue.firCode}`
        );
        continue;
      }

      const channel = await client.channels.fetch(firConfig.defaultChannelId);
      if (!channel || channel.type !== ChannelType.GuildText) {
        console.log(
          `[myVATSIM Check] Invalid channel for FIR ${issue.firCode}`
        );
        continue;
      }

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Event nicht in myVATSIM eingetragen")
        .setDescription(
          `**${issue.eventName}** ist noch nicht für den ${format(
            issue.date,
            "dd.MM.yyyy",
            { locale: de }
          )} in myVATSIM eingetragen.`
        )
        .addFields(
          {
            name: "Event",
            value: issue.eventName,
            inline: true,
          },
          {
            name: "FIR",
            value: issue.firCode,
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

      await channel.send({
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
