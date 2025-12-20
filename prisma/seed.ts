import { PrismaClient, GroupKind, PermissionScope, Role } from "@prisma/client";
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

async function ensureBasePermissions() {
  const permissions = [
    { key: "event.create", description: "Events erstellen" },
    { key: "event.edit", description: "Events bearbeiten" },
    { key: "event.delete", description: "Events löschen" },
    { key: "event.export", description: "Signups der Events Exportieren"},
    { key: "roster.publish", description: "Roster veröffentlichen" },
    { key: "signups.manage", description: "Anmeldungen verwalten" },
    { key: "user.notif", description: "Benutzer benachrichtigen" },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: { key: p.key, description: p.description },
    });
  }
}

async function createStandardGroups(firId: number, firCode: string) {
  await ensureBasePermissions();
  const allPerms = await prisma.permission.findMany();
  const byKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  // FIR-Leitung
  const firLeitung = await prisma.group.create({
    data: {
      name: `${firCode} Eventleitung`,
      description: `Eventleitung der FIR ${firCode}`,
      kind: GroupKind.FIR_LEITUNG,
      firId,
    },
  });

  const leitungPerms = [
    "event.create",
    "event.edit",
    "event.delete",
    "event.export",
    "roster.publish",
    "signups.manage",
    "user.notif",
  ];

  await prisma.groupPermission.createMany({
    data: leitungPerms.map((key) => ({
      groupId: firLeitung.id,
      permissionId: byKey[key],
      scope: PermissionScope.OWN_FIR,
    })),
  });


  // FIR-Team
  const firTeam = await prisma.group.create({
    data: {
      name: `${firCode} Eventteam`,
      description: `Eventteam der FIR ${firCode}`,
      kind: GroupKind.FIR_TEAM,
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
  // // Permissions
  // await ensureBasePermissions();

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
      role: Role.MAIN_ADMIN,
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
