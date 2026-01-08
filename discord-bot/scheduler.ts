import { runWeeklyStaffingCheck } from "./jobs/weeklyStaffing.job";
import { runMyVatsimEventCheck } from "./jobs/myVatsimCheck.job";
import { runStaffingCheck } from "./jobs/staffingCheck.job";
import * as cron from "node-cron";

export function startScheduler() {
  console.log("🕐 Starting Discord bot scheduler...");

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

  // Keep old weekly staffing check for backward compatibility
  // This will be removed once the new system is fully tested
  const ONE_DAY = 1000 * 60 * 60 * 24;
  setInterval(runWeeklyStaffingCheck, ONE_DAY);

  console.log("✅ Discord bot scheduler started");
  console.log("  - myVATSIM check: Daily at 9:00 AM");
  console.log("  - Staffing check: Daily at 10:00 AM");
}

