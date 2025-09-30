import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 👉 HIER deine echte CID oder User-ID eintragen
  const MAINADMIN_ID = 10000007;
  const MAINADMIN_USERNAME = "Seven Web";
  const rating  = "S3";

  await prisma.user.upsert({
    where: { cid: MAINADMIN_ID }, // hängt von deinem Schema ab, ggf. email statt id
    update: {
      role: "MAIN_ADMIN",
    },
    create: {
      cid: MAINADMIN_ID,
      name: MAINADMIN_USERNAME,
      role: "MAIN_ADMIN",
      rating,
    },
  });

  console.log(`✅ Main Admin gesetzt: ${MAINADMIN_USERNAME}})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
