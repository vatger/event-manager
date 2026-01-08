import { ChannelType, EmbedBuilder } from "discord.js";
import { client } from "../client";
import { staffingChecker } from "@/lib/discord/staffingChecker";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { prisma } from "@/lib/prisma";

/**
 * Job to check staffing requirements for today's weekly events
 * Sends notifications to Discord when minimum staffing is not met
 */
export async function runStaffingCheck() {
  console.log("[Staffing Check] Starting staffing check for today's events...");

  try {
    const staffingIssues = await staffingChecker.getStaffingIssuesForNotification();

    for (const issue of staffingIssues) {
      const config = await prisma!.weeklyEventConfiguration.findUnique({
        where: { id: issue.configId },
        include: { fir: true },
      });

      if (!config || !config.discordChannelId) {
        console.log(
          `[Staffing Check] No Discord channel configured for ${issue.configName}`
        );
        continue;
      }

      const channel = await client.channels.fetch(config.discordChannelId);
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

      const embed = new EmbedBuilder()
        .setColor(issue.overallSufficient ? 0x00ff00 : 0xff9900)
        .setTitle(
          issue.overallSufficient
            ? "✅ Staffing ausreichend"
            : "⚠️ Mindestbesetzung nicht erreicht"
        )
        .setDescription(
          `**${issue.configName}** – ${format(issue.date, "EEEE, dd.MM.yyyy", {
            locale: de,
          })}`
        )
        .addFields({
          name: "Besetzung",
          value: staffingDetails || "Keine Anforderungen definiert",
        })
        .setTimestamp();

      // Only send notification if staffing is insufficient
      if (!issue.overallSufficient) {
        const roleId = config.discordRoleId;
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
