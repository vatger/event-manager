import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../lib/db-adapter";
import chalk from "chalk";

const adapter = createDatabaseAdapter();
const prisma = new PrismaClient({ adapter });

async function listMainAdmins() {
  const mainAdmins = await prisma.user.findMany({
    where: { role: "MAIN_ADMIN" },
    orderBy: { name: "asc" },
  });

  if (mainAdmins.length === 0) {
    console.log(chalk.yellow("ℹ️  Keine Main Admins gefunden."));
    return;
  }

  console.log(chalk.cyan("\n📋 Main Admins:\n"));
  console.log(chalk.gray("─".repeat(60)));
  
  mainAdmins.forEach((admin, index) => {
    console.log(
      chalk.white(`${index + 1}. `) +
      chalk.green(admin.name) +
      chalk.gray(` (CID: ${admin.cid})`) +
      (admin.email ? chalk.gray(` - ${admin.email}`) : "")
    );
  });
  
  console.log(chalk.gray("─".repeat(60)));
  console.log(chalk.cyan(`\nGesamt: ${mainAdmins.length} Main Admin(s)\n`));
}

async function main() {
  const args = process.argv.slice(2);

  // Liste alle Main Admins auf
  if (args.includes("--list") || args.includes("-l")) {
    await listMainAdmins();
    await prisma.$disconnect();
    return;
  }

  // Normale Set/Remove Logik
  if (args.length < 1) {
    console.error(chalk.red("❌ Bitte eine CID angeben oder --list verwenden!"));
    console.info(chalk.yellow("\nVerwendung:"));
    console.info(chalk.white("  Main Admin setzen:    npx tsx scripts/setMainAdmin.ts 123456"));
    console.info(chalk.white("  Main Admin entfernen: npx tsx scripts/setMainAdmin.ts 123456 --remove"));
    console.info(chalk.white("  Alle anzeigen:        npx tsx scripts/setMainAdmin.ts --list"));
    process.exit(1);
  }

  const cid = parseInt(args[0], 10);
  const remove = args.includes("--remove");

  if (isNaN(cid)) {
    console.error(chalk.red("❌ Ungültige CID angegeben!"));
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { cid } });

  if (!user) {
    console.error(chalk.red(`❌ Kein Benutzer mit CID ${cid} gefunden.`));
    process.exit(1);
  }

  const newRole = remove ? "USER" : "MAIN_ADMIN";

  if (user.role === newRole) {
    console.log(chalk.yellow(`ℹ️  Benutzer ${user.name} (${cid}) ist bereits ${newRole}.`));
    process.exit(0);
  }

  await prisma.user.update({
    where: { cid },
    data: { role: newRole },
  });

  if (remove) {
    console.log(chalk.green(`✅ Benutzer ${user.name} (${cid}) wurde als MAIN_ADMIN entfernt.`));
  } else {
    console.log(chalk.green(`✅ Benutzer ${user.name} (${cid}) wurde als MAIN_ADMIN gesetzt.`));
  }

  // Optional: Liste nach Änderung anzeigen
  console.log(chalk.gray("\nAktuelle Main Admins:"));
  await listMainAdmins();

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(chalk.red("❌ Fehler:"), err);
  await prisma.$disconnect();
  process.exit(1);
});