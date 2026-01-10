#!/usr/bin/env tsx
/**
 * Discord Bot Test Script
 * 
 * Manuelles Test-Script für die Discord Bot Funktionen.
 * Nur für Entwicklungs- und Testzwecke.
 * 
 * Verwendung:
 *   npx tsx scripts/testDiscordBot.ts [action]
 * 
 * Aktionen:
 *   myvatsim  - Führt myVATSIM Event Check aus
 *   staffing  - Führt Staffing Check aus
 *   cpt       - Führt CPT Checks aus (heute + Vorwarnung)
 *   both      - Führt myVATSIM und Staffing aus
 *   all       - Führt alle Checks aus (myVATSIM, Staffing, CPT)
 * 
 * Beispiele:
 *   npx tsx scripts/testDiscordBot.ts
 *   npx tsx scripts/testDiscordBot.ts myvatsim
 *   npx tsx scripts/testDiscordBot.ts staffing
 *   npx tsx scripts/testDiscordBot.ts cpt
 *   npx tsx scripts/testDiscordBot.ts all
 */

// Load environment variables first
import "dotenv/config";

import { runMyVatsimEventCheck } from "../discord-bot/jobs/myVatsimCheck.job";
import { runStaffingCheck } from "../discord-bot/jobs/staffingCheck.job";
import { runCPTTodayCheck, runCPTAdvanceWarning } from "../discord-bot/jobs/cptCheck.job";
import { startDiscordBot } from "@/discord-bot/client";

async function main() {
  const action = process.argv[2] || "both";

  console.log("===========================================");
  console.log("Discord Bot Test Script");
  console.log("===========================================");
  console.log(`Aktion: ${action}`);
  console.log("===========================================\n");

  if (!["myvatsim", "staffing", "cpt", "both", "all"].includes(action)) {
    console.error("❌ Ungültige Aktion. Verwende: myvatsim, staffing, cpt, both oder all");
    process.exit(1);
  }

  try {
    await startDiscordBot();
    // MyVATSIM Check
    if (action === "myvatsim" || action === "both" || action === "all") {
      console.log("🔍 Führe myVATSIM Event Check aus...\n");
      const myVatsimResult = await runMyVatsimEventCheck();
      console.log("\n✅ MyVATSIM Check abgeschlossen:");
      console.log(JSON.stringify(myVatsimResult, null, 2));
      console.log("\n-------------------------------------------\n");
    }

    // Staffing Check
    if (action === "staffing" || action === "both" || action === "all") {
      console.log("🔍 Führe Staffing Check aus...\n");
      const staffingResult = await runStaffingCheck();
      console.log("\n✅ Staffing Check abgeschlossen:");
      console.log(JSON.stringify(staffingResult, null, 2));
      console.log("\n-------------------------------------------\n");
    }

    // CPT Checks
    if (action === "cpt" || action === "all") {
      console.log("🔍 Führe CPT Today Check aus...\n");
      const cptTodayResult = await runCPTTodayCheck();
      console.log("\n✅ CPT Today Check abgeschlossen:");
      console.log(JSON.stringify(cptTodayResult, null, 2));
      console.log("\n-------------------------------------------\n");

      console.log("🔍 Führe CPT Advance Warning aus...\n");
      const cptAdvanceResult = await runCPTAdvanceWarning();
      console.log("\n✅ CPT Advance Warning abgeschlossen:");
      console.log(JSON.stringify(cptAdvanceResult, null, 2));
      console.log("\n-------------------------------------------\n");
    }

    console.log("✅ Alle Checks erfolgreich abgeschlossen!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fehler beim Ausführen der Checks:");
    console.error(error);
    process.exit(1);
  }
}

main();
