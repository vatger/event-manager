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
 *   both      - Führt beide Checks aus (Standard)
 * 
 * Beispiele:
 *   npx tsx scripts/testDiscordBot.ts
 *   npx tsx scripts/testDiscordBot.ts myvatsim
 *   npx tsx scripts/testDiscordBot.ts staffing
 *   npx tsx scripts/testDiscordBot.ts both
 */

import { runMyVatsimEventCheck } from "../discord-bot/jobs/myVatsimCheck.job";
import { runStaffingCheck } from "../discord-bot/jobs/staffingCheck.job";

async function main() {
  const action = process.argv[2] || "both";

  console.log("===========================================");
  console.log("Discord Bot Test Script");
  console.log("===========================================");
  console.log(`Aktion: ${action}`);
  console.log("===========================================\n");

  if (!["myvatsim", "staffing", "both"].includes(action)) {
    console.error("❌ Ungültige Aktion. Verwende: myvatsim, staffing oder both");
    process.exit(1);
  }

  try {
    // MyVATSIM Check
    if (action === "myvatsim" || action === "both") {
      console.log("🔍 Führe myVATSIM Event Check aus...\n");
      const myVatsimResult = await runMyVatsimEventCheck();
      console.log("\n✅ MyVATSIM Check abgeschlossen:");
      console.log(JSON.stringify(myVatsimResult, null, 2));
      console.log("\n-------------------------------------------\n");
    }

    // Staffing Check
    if (action === "staffing" || action === "both") {
      console.log("🔍 Führe Staffing Check aus...\n");
      const staffingResult = await runStaffingCheck();
      console.log("\n✅ Staffing Check abgeschlossen:");
      console.log(JSON.stringify(staffingResult, null, 2));
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
