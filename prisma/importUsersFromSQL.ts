import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../lib/db-adapter";
import chalk from "chalk"; // npm install chalk

const adapter = createDatabaseAdapter();
const prisma = new PrismaClient({ adapter });

async function importUsers() {
  console.log(chalk.cyan.bold("\n🚀 Starte User-Import..."));

  const startTime = Date.now();

  // --- Quelle wählen ---
  let sql: string | undefined;

  if (process.env.USERDATA_SQL_B64) {
    console.log(chalk.gray("🔍 Quelle: .env (Base64 decodiert)"));
    sql = Buffer.from(process.env.USERDATA_SQL_B64, "base64").toString("utf8");
  } else if (process.env.USERDATA_URL) {
    console.log(chalk.gray("🔍 Quelle: Remote Download"));
    try {
      const res = await fetch(process.env.USERDATA_URL, {
        redirect: "follow",
        headers: { "User-Agent": "EventManager Import Script" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sql = await res.text();
    } catch (err) {
      console.error(chalk.red("❌ Fehler beim Laden der Datei:"), err);
      process.exit(1);
    }
  } else {
    console.error(chalk.red("❌ Keine Datenquelle gefunden (.env oder URL)!"));
    process.exit(1);
  }

  // --- Daten extrahieren ---
  const regex =
    /\((\d+),\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'[^']*',\s*'[^']*'\)/g;

  const users: { cid: number; name: string; rating: string; role: string }[] = [];

  for (const match of sql.matchAll(regex)) {
    const [, , cidStr, name, rating, role] = match;
    users.push({
      cid: Number(cidStr),
      name,
      rating,
      role,
    });
  }

  if (users.length === 0) {
    console.log(chalk.yellow("⚠️ Keine gültigen User-Einträge gefunden."));
    process.exit(0);
  }

  console.log(chalk.green(`📊 ${users.length} User-Datensätze gefunden.`));

  // --- Import ---
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [index, user] of users.entries()) {
    const prefix = chalk.gray(`[${index + 1}/${users.length}]`);

    try {
      const existing = await prisma.user.findUnique({
        where: { cid: user.cid },
      });

      if (!existing) {
        await prisma.user.create({
          data: {
            cid: user.cid,
            name: user.name,
            rating: user.rating,
            role: "USER",
          },
        });
        created++;
        console.log(`${prefix} ${chalk.green("➕ Neu")} → ${user.name} (${user.cid})`);
      } else if (
        existing.name.toLowerCase() === "unbekannt" ||
        existing.name.trim() === ""
      ) {
        await prisma.user.update({
          where: { cid: user.cid },
          data: {
            name: user.name,
            rating: user.rating,
            role: "USER",
          },
        });
        updated++;
        console.log(`${prefix} ${chalk.blue("♻️  Aktualisiert")} → ${user.name} (${user.cid})`);
      } else {
        skipped++;
        console.log(`${prefix} ${chalk.gray("⏩ Übersprungen")} → ${user.name}`);
      }
    } catch (err) {
      errors++;
      console.error(`${prefix} ${chalk.red("❌ Fehler")} bei ${user.cid}:`, err);
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // --- Zusammenfassung ---
  console.log(chalk.bold("\n📦 Zusammenfassung"));
  console.log(chalk.green(`   ➕ Erstellt:     ${created}`));
  console.log(chalk.blue(`   ♻️  Aktualisiert: ${updated}`));
  console.log(chalk.gray(`   ⏩ Übersprungen:  ${skipped}`));
  if (errors > 0) console.log(chalk.red(`   ❌ Fehler:       ${errors}`));
  console.log(chalk.cyan(`   ⏱️  Dauer:        ${duration}s`));
  console.log(chalk.bold.green("\n✅ User-Import abgeschlossen.\n"));

  await prisma.$disconnect();
}

importUsers().catch((err) => {
  console.error(chalk.red("❌ Unerwarteter Fehler beim Import:"), err);
  prisma.$disconnect();
});
