import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Setting firCode='EDMM' for all existing events...");

  const result = await prisma.event.updateMany({
    where: {
      firCode: null, // nur die, die noch keinen Code haben
    },
    data: {
      firCode: "EDMM",
    },
  });

  console.log(`✅ Updated ${result.count} events.`);
}

main()
  .catch((err) => {
    console.error("❌ Error setting firCode:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
