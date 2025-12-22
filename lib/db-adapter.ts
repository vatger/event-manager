import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Dummy DATABASE_URL used during Docker build (must match Dockerfile)
const DOCKER_BUILD_DUMMY_URL = "mysql://user:pass@localhost:3306/dummy";

/**
 * Creates a database adapter based on environment configuration.
 * 
 * If USE_TEST_DB is set to "true", uses SQLite (libsql) adapter for local development.
 * Otherwise, uses MariaDB adapter for production/MySQL databases.
 * 
 * @returns Database adapter for PrismaClient
 */
export function createDatabaseAdapter() {
  // During build phase, we don't need a database adapter
  // Check multiple indicators for build phase
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "true"
  ) {
    return undefined;
  }
  
  // If no DATABASE_URL is set, likely in build phase or testing
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === "production") {
      console.warn("DATABASE_URL not set in production environment");
    }
    return undefined;
  }
  
  // Check for dummy DATABASE_URL used in Docker build (must match Dockerfile line 13)
  if (process.env.DATABASE_URL === DOCKER_BUILD_DUMMY_URL) {
    return undefined;
  }
  
  const useTestDb = process.env.USE_TEST_DB === "true";

  if (useTestDb) {
    // SQLite adapter for local development
    const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
    return new PrismaLibSql({
      url: dbUrl,
    });
  } else {
    // MariaDB adapter for production
    // Validate required environment variables
    const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables for MariaDB connection: ${missingVars.join(', ')}\n` +
        `Please set these variables in your .env file or use SQLite by setting USE_TEST_DB=true`
      );
    }

    const config = {
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
      connectionLimit: 5,
    };
    return new PrismaMariaDb(config);
  }
}
