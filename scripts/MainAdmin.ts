import "dotenv/config";
import chalk from "chalk";

/**
 * This script lists the current Main Admins as configured via the
 * MAIN_ADMIN_CIDS environment variable.
 *
 * Main Admins are no longer stored in the database – they are managed
 * exclusively through the MAIN_ADMIN_CIDS env variable (comma-separated CIDs).
 */

function getMainAdminCids(): number[] {
  const raw = process.env.MAIN_ADMIN_CIDS || '';
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function main() {
  const cids = getMainAdminCids();

  if (cids.length === 0) {
    console.log(chalk.yellow("ℹ️  Keine Main Admins konfiguriert (MAIN_ADMIN_CIDS ist leer)."));
    console.log(chalk.gray("   Setze die MAIN_ADMIN_CIDS Umgebungsvariable mit kommagetrennten CIDs."));
    return;
  }

  console.log(chalk.cyan("\n📋 Konfigurierte Main Admins (via MAIN_ADMIN_CIDS):\n"));
  console.log(chalk.gray("─".repeat(60)));
  cids.forEach((cid, index) => {
    console.log(chalk.white(`${index + 1}. CID: `) + chalk.green(String(cid)));
  });
  console.log(chalk.gray("─".repeat(60)));
  console.log(chalk.cyan(`\nGesamt: ${cids.length} Main Admin(s)\n`));
  console.log(chalk.gray("Hinweis: Main Admins werden ausschließlich über die MAIN_ADMIN_CIDS"));
  console.log(chalk.gray("         Umgebungsvariable verwaltet, nicht über die Datenbank.\n"));
}

main().catch((err) => {
  console.error(chalk.red("❌ Fehler:"), err);
  process.exit(1);
});
