import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../lib/db-adapter";
import chalk from "chalk";

const adapter = createDatabaseAdapter();
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(chalk.red("❌ Bitte eine CID angeben!"));
    console.info(chalk.yellow("Beispiel: npx tsx scripts/setMainAdmin.ts 123456"));
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
    console.log(chalk.yellow(`ℹ️ Benutzer ${user.name} (${cid}) ist bereits ${newRole}.`));
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

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(chalk.red("❌ Fehler:"), err);
  await prisma.$disconnect();
  process.exit(1);
});
