import { Message, EmbedBuilder } from "discord.js";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { discordBotConfig } from "../config/weeklyEvents.config";
import prisma from "@/lib/prisma";

/**
 * Discord Bot Command: Weekly Events
 * 
 * Zeigt kommende Termine eines Weekly Events
 * Usage: !MüMi oder !weeklys <EventName>
 */

export async function handleWeeklyEventsCommand(
  message: Message,
  commandName: string,
  args: string[]
): Promise<void> {
  try {
    // Bestimme Event-Namen
    let eventName: string | undefined;

    // Verwende konfigurierte Aliase aus Config-Datei
    const aliases = discordBotConfig.commandAliases || {};

    // Verwende Alias falls vorhanden, sonst args
    const lookupKey = commandName.toLowerCase().replace(/^!/, "");
    eventName = aliases[lookupKey];

    // Falls kein Alias gefunden, versuche Event-Namen aus Args zu konstruieren
    if (!eventName && args.length > 0) {
      eventName = args.join(" ");
    }

    if (!eventName) {
      // Zeige Liste aller verfügbaren Events
      await showAllWeeklyEvents(message);
      return;
    }

    // Suche Event in Datenbank (case-insensitive)
    const weeklyEvent = await prisma!.weeklyEventConfiguration.findFirst({
      where: {
        name: {
          equals: eventName,
        },
        enabled: true,
      },
      include: {
        occurrences: {
          where: {
            date: {
              gte: new Date(),
            },
          },
          orderBy: {
            date: "asc",
          },
          take: 10, // Zeige nächste 10 Termine
        },
      },
    });

    if (!weeklyEvent || weeklyEvent.occurrences.length === 0) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle("❓ Event nicht gefunden")
            .setDescription(
              `Event "${eventName}" wurde nicht gefunden oder hat keine kommenden Termine.\n\n` +
                `Verfügbare Events kannst du mit \`!weeklys\` anzeigen.`
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    // Erstelle Embed mit kommenden Terminen
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📅 ${weeklyEvent.name}`)
      .setDescription(
        `Rhythmus: ${weeklyEvent.weeksOn} Woche(n) aktiv, ${weeklyEvent.weeksOff} Woche(n) Pause`
      )
      .setTimestamp();

    // Füge Termine als Fields hinzu
    weeklyEvent.occurrences.forEach((occurrence, index) => {
      const dateStr = format(parseISO(occurrence.date.toISOString()), "EEEE, dd. MMMM yyyy", {
        locale: de,
      });
      
      let statusIcon = "📆";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const occurrenceDate = new Date(occurrence.date);
      occurrenceDate.setHours(0, 0, 0, 0);

      if (occurrenceDate.getTime() === today.getTime()) {
        statusIcon = "🔴 **Heute!**";
      } else if (occurrenceDate < today) {
        statusIcon = "✅";
      }

      embed.addFields({
        name: `${index + 1}. ${statusIcon}`,
        value: dateStr,
        inline: true,
      });
    });

    // Informationen über MyVATSIM und Staffing Status hinzufügen (falls vorhanden)
    const nextOccurrence = weeklyEvent.occurrences[0];
    if (nextOccurrence) {
      let statusInfo = [];
      
      if (nextOccurrence.myVatsimChecked) {
        statusInfo.push(
          nextOccurrence.myVatsimRegistered
            ? "✅ In myVATSIM eingetragen"
            : "❌ Nicht in myVATSIM"
        );
      }
      
      if (nextOccurrence.staffingChecked) {
        statusInfo.push(
          nextOccurrence.staffingSufficient
            ? "✅ Staffing ausreichend"
            : "⚠️ Staffing unzureichend"
        );
      }

      if (statusInfo.length > 0) {
        embed.addFields({
          name: "Status nächster Termin",
          value: statusInfo.join("\n"),
          inline: false,
        });
      }
    }

    embed.setFooter({ text: `Insgesamt ${weeklyEvent.occurrences.length} kommende Termine` });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error handling weekly events command:", error);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Fehler")
          .setDescription("Es ist ein Fehler beim Abrufen der Events aufgetreten.")
          .setTimestamp(),
      ],
    });
  }
}

/**
 * Zeigt alle verfügbaren Weekly Events
 */
async function showAllWeeklyEvents(message: Message): Promise<void> {
  try {
    const weeklyEvents = await prisma!.weeklyEventConfiguration.findMany({
      where: {
        enabled: true,
      },
      include: {
        occurrences: {
          where: {
            date: {
              gte: new Date(),
            },
          },
          orderBy: {
            date: "asc",
          },
          take: 1, // Nur nächster Termin
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    if (weeklyEvents.length === 0) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle("📋 Keine Weekly Events")
            .setDescription("Es sind derzeit keine Weekly Events konfiguriert.")
            .setTimestamp(),
        ],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📋 Verfügbare Weekly Events")
      .setDescription(
        "Verwende `!<EventName>` oder `!weeklys <EventName>` für Details.\n" +
          "Beispiel: `!MüMi` oder `!weeklys München Mittwoch`"
      )
      .setTimestamp();

    weeklyEvents.forEach((event) => {
      const nextDate = event.occurrences[0]
        ? format(parseISO(event.occurrences[0].date.toISOString()), "dd.MM.yyyy", { locale: de })
        : "Keine kommenden Termine";

      embed.addFields({
        name: event.name,
        value: `Nächster Termin: ${nextDate}`,
        inline: false,
      });
    });

    embed.setFooter({ text: `${weeklyEvents.length} aktive Weekly Events` });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error showing all weekly events:", error);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ Fehler")
          .setDescription("Es ist ein Fehler beim Abrufen der Events aufgetreten.")
          .setTimestamp(),
      ],
    });
  }
}
