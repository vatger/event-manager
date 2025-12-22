// scripts/showMigrations.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../lib/db-adapter";

const adapter = createDatabaseAdapter();
const prisma = new PrismaClient({ adapter });

async function main() {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT id, migration_name, applied_steps_count, finished_at, rolled_back_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC
  `);
  console.table(migrations);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
