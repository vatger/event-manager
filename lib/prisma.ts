import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "./db-adapter";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // ⛔ Build-Phase: KEIN Prisma
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "true"
  ) {
    return null;
  }

  const adapter = createDatabaseAdapter();

  // ⛔ Prisma 7 REQUIREMENT
  if (!adapter && !process.env.PRISMA_ACCELERATE_URL) {
    throw new Error(
      "PrismaClient requires either an adapter or PRISMA_ACCELERATE_URL"
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

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma ?? undefined;
}

export default prisma;
