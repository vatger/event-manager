import "dotenv/config"; // Load environment variables
import { startDiscordBot } from "./client";
import { startScheduler } from "./scheduler";

(async () => {
  try {
    console.log("🚀 Starting Discord Bot...");
    await startDiscordBot();
    startScheduler();
    console.log("✅ Discord Bot is running");
  } catch (error) {
    console.error("❌ Failed to start Discord Bot:", error);
    process.exit(1);
  }
})();
