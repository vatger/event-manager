import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "./db-adapter";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = createDatabaseAdapter();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(adapter ? { adapter } : {}),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
