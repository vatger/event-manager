import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Creates a database adapter based on environment configuration.
 * 
 * If USE_TEST_DB is set to "true", uses SQLite (libsql) adapter for local development.
 * Otherwise, uses MariaDB adapter for production/MySQL databases.
 * 
 * @returns Database adapter for PrismaClient
 */
export function createDatabaseAdapter() {
  const useTestDb = process.env.USE_TEST_DB === "true";

  if (useTestDb) {
    // SQLite adapter for local development
    const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
    return new PrismaLibSql({
      url: dbUrl,
    });
  } else {
    // MariaDB adapter for production
    const config = {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 5,
    };
    return new PrismaMariaDb(config);
  }
}
