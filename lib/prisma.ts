import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "./db-adapter";

/**
 * Global Prisma instance for hot reloading in development
 */
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Checks if we're in a build phase where Prisma is not available
 */
function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "true"
  );
}

/**
 * Creates a new PrismaClient instance with the appropriate database adapter
 * @throws {Error} If Prisma cannot be initialized outside of build phase
 */
function createPrismaClient(): PrismaClient {
  // During build phase, we don't initialize Prisma
  // This is expected and handled by the build-phase-aware export
  if (isBuildPhase()) {
    throw new Error("Prisma is not available during build phase");
  }

  const adapter = createDatabaseAdapter();

  // Prisma 7 requires either an adapter or PRISMA_ACCELERATE_URL
  if (!adapter && !process.env.PRISMA_ACCELERATE_URL) {
    throw new Error(
      "PrismaClient requires either an adapter or PRISMA_ACCELERATE_URL. " +
      "Please configure DATABASE_URL or set USE_TEST_DB=true for development."
    );
  }

  return new PrismaClient({
    log: ["error", "warn"],
    ...(adapter ? { adapter } : {}),
    ...(process.env.PRISMA_ACCELERATE_URL
      ? { accelerateUrl: process.env.PRISMA_ACCELERATE_URL }
      : {}),
  });
}

/**
 * Gets or creates the Prisma client instance
 * Uses a global singleton in development for hot reloading
 */
function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  
  // Cache in global for hot reloading in development
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  
  return client;
}

/**
 * Type-safe Prisma client instance
 * During build phase, accessing this will throw an error with a clear message
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (isBuildPhase()) {
      throw new Error(
        `Cannot access Prisma during build phase. ` +
        `Make sure you're not calling database operations in module scope or during SSG.`
      );
    }
    
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    
    // Bind methods to the client instance
    if (typeof value === "function") {
      return value.bind(client);
    }
    
    return value;
  }
});

/**
 * Helper function to check if Prisma is available
 * Use this when you need to conditionally handle Prisma availability
 */
export function isPrismaAvailable(): boolean {
  return !isBuildPhase();
}

// Default export for backwards compatibility
export default prisma;
