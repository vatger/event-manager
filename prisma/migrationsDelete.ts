import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const migrationName = process.argv[2]; // Argument aus CLI (z. B. 20251025_added_training_cashing_tablesfor_auto_endo)

  if (!migrationName) {
    console.error("❌ Bitte gib den Migrationsnamen an, z. B.:");
    console.error("   npx tsx scripts/deleteMigration.ts 20251025_added_training_cashing_tablesfor_auto_endo");
    process.exit(1);
  }

  // Sicherheitscheck: existiert die Migration überhaupt?
  const existing = await prisma.$queryRawUnsafe<
    { migration_name: string }[]
  >(`SELECT migration_name FROM _prisma_migrations WHERE migration_name = ?`, migrationName);

  if (existing.length === 0) {
    console.log(`⚠️ Keine Migration mit dem Namen "${migrationName}" gefunden.`);
    process.exit(0);
  }

  // Bestätigungsabfrage (manuell, aber simpel)
  console.log(`🗑  Lösche Migrationseintrag "${migrationName}" aus _prisma_migrations...`);
  await prisma.$executeRawUnsafe(
    `DELETE FROM _prisma_migrations WHERE migration_name = ?`,
    migrationName
  );

  console.log("✅ Migrationseintrag erfolgreich gelöscht.");
}

main()
  .catch((e) => {
    console.error("Fehler beim Löschen der Migration:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
