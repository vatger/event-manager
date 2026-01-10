import { runMyVatsimEventCheck } from "./jobs/myVatsimCheck.job";
import { runStaffingCheck } from "./jobs/staffingCheck.job";
import { runCPTTodayCheck, runCPTAdvanceWarning } from "./jobs/cptCheck.job";
import * as cron from "node-cron";
import { discordBotConfig } from "./config/weeklyEvents.config";

export function startScheduler() {
  console.log("🕐 Starting Discord bot scheduler...");

  // Run CPT today check daily at 8:00 AM
  // Check if there are CPTs scheduled for today
  if (discordBotConfig.cptNotifications?.channelId) {
    cron.schedule("0 8 * * *", async () => {
      console.log("[Scheduler] Running CPT today check...");
      try {
        await runCPTTodayCheck();
      } catch (error) {
        console.error("[Scheduler] CPT today check failed:", error);
      }
    });
    console.log("  - CPT today check: Daily at 8:00 AM");
  }

  // Run myVATSIM event check daily at 9:00 AM
  // Check if weekly and irregular events are registered in myVATSIM
  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Running myVATSIM event check...");
    try {
      await runMyVatsimEventCheck();
    } catch (error) {
      console.error("[Scheduler] myVATSIM event check failed:", error);
    }
  });

  // Run CPT advance warning daily at 9:30 AM
  // Check if there are CPTs scheduled X days from now
  if (discordBotConfig.cptNotifications?.advanceWarning?.enabled) {
    cron.schedule("30 9 * * *", async () => {
      console.log("[Scheduler] Running CPT advance warning...");
      try {
        await runCPTAdvanceWarning();
      } catch (error) {
        console.error("[Scheduler] CPT advance warning failed:", error);
      }
    });
    console.log(`  - CPT advance warning: Daily at 9:30 AM (${discordBotConfig.cptNotifications.advanceWarning.daysAhead} days ahead)`);
  }

  // Run staffing check daily at 10:00 AM
  // Check if today's events have minimum staffing
  cron.schedule("0 10 * * *", async () => {
    console.log("[Scheduler] Running staffing check...");
    try {
      await runStaffingCheck();
    } catch (error) {
      console.error("[Scheduler] Staffing check failed:", error);
    }
  });

  console.log("✅ Discord bot scheduler started");
  console.log("  - myVATSIM check: Daily at 9:00 AM");
  console.log("  - Staffing check: Daily at 10:00 AM");
}

