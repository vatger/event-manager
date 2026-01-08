import { startDiscordBot } from "./client";
import { startScheduler } from "./scheduler";

(async () => {
  await startDiscordBot();
  startScheduler();
})();
