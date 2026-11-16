import "dotenv/config";
import { PrismaClient, GroupKind } from "@prisma/client";
import { createDatabaseAdapter } from "../lib/db-adapter";
import { syncPermissionCatalog } from "../lib/acl/catalogSync";

const adapter = createDatabaseAdapter();
const prisma = new PrismaClient({ adapter });

async function createStandardGroups(firId: number, firCode: string) {
  // Leitungsgruppe: genau eine je FIR, hat fest alle Rechte des Katalogs
  const firLeitung = await prisma.group.create({
    data: {
      name: `${firCode} Eventleitung`,
      description: `Eventleitung der FIR ${firCode}`,
      kind: GroupKind.FIR_LEITUNG,
      firId,
    },
  });

  // Eine normale Untergruppe als Ausgangspunkt – ihre Rechte verteilt die Leitung
  const firTeam = await prisma.group.create({
    data: {
      name: `${firCode} Eventteam`,
      description: `Eventteam der FIR ${firCode}`,
      kind: GroupKind.CUSTOM,
      firId,
    },
  });

  return { firLeitung, firTeam };
}

async function main() {
  console.log("🌱 Seeding initial data...");

  // Datenbank bereinigen
  // await prisma.eventSignup.deleteMany();
  // await prisma.notification.deleteMany();
  // await prisma.userGroup.deleteMany();
  // await prisma.groupPermission.deleteMany();
  // await prisma.event.deleteMany();
  // await prisma.group.deleteMany();
  // await prisma.permission.deleteMany();
  // await prisma.vATGERLeitung.deleteMany();
  // await prisma.eventSignupCache.deleteMany();
  // await prisma.user.deleteMany();
  // await prisma.fIR.deleteMany();

  // Rechtekatalog aus dem Code übernehmen
  await syncPermissionCatalog(prisma);

  // FIRs erstellen
  const firs = [
    { code: "EDMM", name: "FIR München" },
    { code: "EDWW", name: "FIR Bremen" },
    { code: "EDGG", name: "FIR Langen" },
  ];

  for (const firData of firs) {
    const fir = await prisma.fIR.create({ data: firData });
    await createStandardGroups(fir.id, fir.code);
  }

  // Beispiel-Main-Admin (für EDMM)
  const firEDMM = await prisma.fIR.findUnique({ where: { code: "EDMM" } });
  const mainAdmin = await prisma.user.create({
    data: {
      cid: 1649341,
      name: "Yannik Schäffler",
      rating: "C1",
      firId: firEDMM?.id,
    },
  });

  // Zuweisung zu EDMM-Leitung & Team
  const edmmGroups = await prisma.group.findMany({
    where: { firId: firEDMM?.id },
  });

  for (const g of edmmGroups) {
    await prisma.userGroup.create({
      data: { userCID: Number(mainAdmin.cid), groupId: g.id },
    });
  }

  console.log("✅ Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Fehler beim Seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
