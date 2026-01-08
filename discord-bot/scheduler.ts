import { runWeeklyStaffingCheck } from "./jobs/weeklyStaffing.job";

export function startScheduler() {
  // täglich um 10 Uhr
  const ONE_DAY = 1000 * 60 * 60 * 24;

  setInterval(runWeeklyStaffingCheck, ONE_DAY);
}
