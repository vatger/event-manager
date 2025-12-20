// scripts/showMigrations.ts
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
};
const adapter = new PrismaMariaDb(config);
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
