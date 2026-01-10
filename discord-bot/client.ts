import { Client, GatewayIntentBits } from "discord.js";
import { handleWeeklyEventsCommand } from "./commands/weeklyEvents";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

export async function startDiscordBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error("❌ DISCORD_BOT_TOKEN not found in environment variables");
    throw new Error("DISCORD_BOT_TOKEN is required");
  }

  // Message handler für Commands
  client.on("messageCreate", async (message) => {
    // Ignoriere Bot-Nachrichten
    if (message.author.bot) return;

    // Ignoriere Nachrichten ohne Inhalt
    if (!message.content) return;

    const content = message.content.trim();

    // Prüfe auf Commands
    if (content.startsWith("!")) {
      const args = content.slice(1).split(/\s+/);
      const command = args.shift()?.toLowerCase();

      if (!command) return;

      // Weekly Events Commands
      const weeklyCommands = [
        "mümi",
        "mumi",
        "weeklys",
        "weekly",
        "events",
        "termine",
      ];

      if (weeklyCommands.includes(command) || content.startsWith("!")) {
        // Übergebe Command und Args
        await handleWeeklyEventsCommand(message, `!${command}`, args);
      }
    }
  });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log("🤖 Discord Bot connected successfully");
    console.log(`   Logged in as: ${client.user?.tag}`);
    console.log("   Message commands enabled:");
    console.log("   - !MüMi, !weeklys, !weekly, !events, !termine");
  } catch (error) {
    console.error("❌ Failed to connect Discord bot:", error);
    throw error;
  }
}
