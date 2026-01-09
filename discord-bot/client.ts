import { Client, GatewayIntentBits } from "discord.js";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

export async function startDiscordBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error("❌ DISCORD_BOT_TOKEN not found in environment variables");
    throw new Error("DISCORD_BOT_TOKEN is required");
  }

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log("🤖 Discord Bot connected successfully");
    console.log(`   Logged in as: ${client.user?.tag}`);
  } catch (error) {
    console.error("❌ Failed to connect Discord bot:", error);
    throw error;
  }
}
