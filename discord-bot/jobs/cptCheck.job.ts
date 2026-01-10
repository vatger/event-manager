import { ChannelType, EmbedBuilder } from "discord.js";
import { client } from "../client";
import { cptChecker } from "@/lib/discord/cptChecker";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { discordBotConfig } from "../config/weeklyEvents.config";

/**
 * Replace template variables in CPT embed text
 */
function replaceCPTVariables(
  text: string | undefined,
  variables: {
    examiner?: string;
    trainee?: string;
    position?: string;
    time?: string;
    date?: string;
    daysUntil?: number;
  }
): string {
  if (!text) return '';
  
  return text
    .replace(/{examiner}/g, variables.examiner || '')
    .replace(/{trainee}/g, variables.trainee || '')
    .replace(/{position}/g, variables.position || '')
    .replace(/{time}/g, variables.time || '')
    .replace(/{date}/g, variables.date || '')
    .replace(/{daysUntil}/g, variables.daysUntil?.toString() || '');
}

/**
 * Job to check for CPTs scheduled for today
 * Sends notifications to Discord channel when CPTs are found
 */
export async function runCPTTodayCheck() {
  console.log("[CPT Today Check] Starting CPT check for today...");

  const config = discordBotConfig.cptNotifications;
  
  if (!config || !config.channelId) {
    console.log("[CPT Today Check] CPT notifications not configured, skipping");
    return { cptsFound: 0 };
  }

  try {
    const cpts = await cptChecker.getCPTsForToday(config.positionFilters);

    if (cpts.length === 0) {
      console.log("[CPT Today Check] No CPTs found for today");
      return { cptsFound: 0 };
    }

    const channel = await client.channels.fetch(config.channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.log("[CPT Today Check] Invalid channel configured");
      return { cptsFound: 0 };
    }

    for (const cpt of cpts) {
      const embedConfig = config.embeds?.today || {};
      const formattedDate = format(cpt.date, "dd.MM.yyyy", { locale: de });

      const embed = new EmbedBuilder()
        .setColor(embedConfig.color ?? 0xff0000)
        .setTitle(replaceCPTVariables(embedConfig.title, {
          examiner: cpt.examiner_name,
          trainee: cpt.trainee_name,
          position: cpt.position,
          time: cpt.time,
          date: formattedDate,
        }))
        .setDescription(replaceCPTVariables(embedConfig.description, {
          examiner: cpt.examiner_name,
          trainee: cpt.trainee_name,
          position: cpt.position,
          time: cpt.time,
          date: formattedDate,
        }))
        .addFields(
          {
            name: "Prüfer (lokal)",
            value: cpt.examiner_name,
            inline: true,
          },
          {
            name: "Prüfling",
            value: cpt.trainee_name,
            inline: true,
          },
          {
            name: "Position",
            value: cpt.position,
            inline: true,
          },
          {
            name: "Uhrzeit",
            value: cpt.time,
            inline: true,
          },
          {
            name: "Status",
            value: cpt.confirmed ? "✅ Bestätigt" : "⏳ Ausstehend",
            inline: true,
          }
        )
        .setTimestamp();

      if (embedConfig.footer) {
        embed.setFooter({ text: embedConfig.footer });
      }

      const mention = config.roleId ? `<@&${config.roleId}>` : "";

      await channel.send({
        content: mention,
        embeds: [embed],
      });

      console.log(`[CPT Today Check] Sent notification for CPT ${cpt.id}`);
    }

    console.log(`[CPT Today Check] Completed. CPTs found: ${cpts.length}`);

    return { cptsFound: cpts.length };
  } catch (error) {
    console.error("[CPT Today Check] Error:", error);
    throw error;
  }
}

/**
 * Job to check for upcoming CPTs (advance warning)
 * Sends notifications X days before the CPT
 */
export async function runCPTAdvanceWarning() {
  console.log("[CPT Advance Warning] Starting CPT advance warning check...");

  const config = discordBotConfig.cptNotifications;
  
  if (!config || !config.channelId || !config.advanceWarning?.enabled) {
    console.log("[CPT Advance Warning] Advance warning not configured or disabled, skipping");
    return { cptsFound: 0 };
  }

  const daysAhead = config.advanceWarning.daysAhead || 3;

  try {
    const cpts = await cptChecker.getCPTsInDays(daysAhead, config.positionFilters);

    if (cpts.length === 0) {
      console.log(`[CPT Advance Warning] No CPTs found for ${daysAhead} days from now`);
      return { cptsFound: 0 };
    }

    const channel = await client.channels.fetch(config.channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.log("[CPT Advance Warning] Invalid channel configured");
      return { cptsFound: 0 };
    }

    for (const cpt of cpts) {
      const embedConfig = config.embeds?.upcoming || {};
      const formattedDate = format(cpt.date, "EEEE, dd.MM.yyyy", { locale: de });

      const embed = new EmbedBuilder()
        .setColor(embedConfig.color ?? 0x0099ff)
        .setTitle(replaceCPTVariables(embedConfig.title, {
          examiner: cpt.examiner_name,
          trainee: cpt.trainee_name,
          position: cpt.position,
          time: cpt.time,
          date: formattedDate,
          daysUntil: daysAhead,
        }))
        .setDescription(replaceCPTVariables(embedConfig.description, {
          examiner: cpt.examiner_name,
          trainee: cpt.trainee_name,
          position: cpt.position,
          time: cpt.time,
          date: formattedDate,
          daysUntil: daysAhead,
        }))
        .addFields(
          {
            name: "Prüfer (lokal)",
            value: cpt.examiner_name,
            inline: true,
          },
          {
            name: "Prüfling",
            value: cpt.trainee_name,
            inline: true,
          },
          {
            name: "Position",
            value: cpt.position,
            inline: true,
          },
          {
            name: "Datum & Uhrzeit",
            value: `${formattedDate}\n${cpt.time} Uhr`,
            inline: true,
          },
          {
            name: "Status",
            value: cpt.confirmed ? "✅ Bestätigt" : "⏳ Ausstehend",
            inline: true,
          }
        )
        .setTimestamp();

      if (embedConfig.footer) {
        embed.setFooter({ text: embedConfig.footer });
      }

      // Optional: use different role for info pings or no role at all
      const mention = config.advanceWarning.roleId 
        ? `<@&${config.advanceWarning.roleId}>` 
        : "";

      await channel.send({
        content: mention,
        embeds: [embed],
      });

      console.log(`[CPT Advance Warning] Sent notification for CPT ${cpt.id}`);
    }

    console.log(`[CPT Advance Warning] Completed. CPTs found: ${cpts.length}`);

    return { cptsFound: cpts.length };
  } catch (error) {
    console.error("[CPT Advance Warning] Error:", error);
    throw error;
  }
}
