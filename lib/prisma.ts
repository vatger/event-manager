import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "./db-adapter";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = createDatabaseAdapter();

// Build PrismaClient options, conditionally including adapter
const prismaOptions: any = {
  log: ["error", "warn"],
};

if (adapter) {
  prismaOptions.adapter = adapter;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
