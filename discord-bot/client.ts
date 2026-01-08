import { Client, GatewayIntentBits } from "discord.js";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

export async function startDiscordBot() {
  await client.login(process.env.DISCORD_BOT_TOKEN);
  console.log("🤖 Discord Bot connected");
}
