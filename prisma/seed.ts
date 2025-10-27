import { PrismaClient, GroupKind, PermissionScope, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureBasePermissions() {
  const permissions = [
    { key: "event.create", description: "Events erstellen" },
    { key: "event.edit", description: "Events bearbeiten" },
    { key: "event.delete", description: "Events löschen" },
    { key: "group.manage", description: "Gruppen verwalten" },
    { key: "roster.publish", description: "Roster veröffentlichen" },
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
  // 🔹 Stelle sicher, dass alle Permissions da sind
  await ensureBasePermissions();

  const allPerms = await prisma.permission.findMany();
  const byKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  // ✅ Sicherheitscheck
  const missing = [
    "event.create",
    "event.edit",
    "event.delete",
    "group.manage",
    "roster.publish",
  ].filter((key) => !byKey[key]);

  if (missing.length > 0) {
    console.warn("⚠️ Fehlende Permissions:", missing);
  }

  // FIR-Leitung
  const firLeitung = await prisma.group.create({
    data: {
      name: `FIR ${firCode} Leitung`,
      description: `Eventleitung der FIR ${firCode}`,
      kind: GroupKind.FIR_LEITUNG,
      firId,
    },
  });

  const leitungPerms = [
    "event.create",
    "event.edit",
    "event.delete",
    "group.manage",
    "roster.publish",
  ].filter((k) => byKey[k]); // nur vorhandene nehmen

  await prisma.groupPermission.createMany({
    data: leitungPerms.map((key) => ({
      groupId: firLeitung.id,
      permissionId: byKey[key],
      scope: PermissionScope.OWN_FIR,
    })),
  });

  // FIR-Event-Team
  const firTeam = await prisma.group.create({
    data: {
      name: `FIR ${firCode} Event Team`,
      description: `Eventteam der FIR ${firCode}`,
      kind: GroupKind.FIR_TEAM,
      firId,
    },
  });

  const teamPerms = ["event.edit" ].filter((k) => byKey[k]);

  await prisma.groupPermission.createMany({
    data: teamPerms.map((key) => ({
      groupId: firTeam.id,
      permissionId: byKey[key],
      scope: PermissionScope.OWN_FIR,
    })),
  });

  return { firLeitung, firTeam };
}

async function main() {
  console.log("🌱 Seeding initial data...");

  // Bereinigen
  await prisma.eventSignup.deleteMany();
  await prisma.event.deleteMany();
  await prisma.userGroup.deleteMany();
  await prisma.groupPermission.deleteMany();
  await prisma.group.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.fIR.deleteMany();
  await prisma.user.deleteMany();

  // Permissions + FIR erstellen
  await ensureBasePermissions();

  const fir = await prisma.fIR.create({
    data: { code: "EDMM", name: "FIR München" },
  });
  const { firLeitung, firTeam } = await createStandardGroups(fir.id, fir.code);

  // Benutzer
  const mainAdmin = await prisma.user.create({
    data: {
      cid: 1649341,
      name: "Yannik Schäffler",
      rating: "C1",
      role: Role.MAIN_ADMIN,
    },
  });

  // Gruppenzuweisung
  await prisma.userGroup.create({
    data: { userCID: Number(mainAdmin.cid), groupId: firLeitung.id },
  });
  await prisma.userGroup.create({
    data: { userCID: Number(mainAdmin.cid), groupId: firTeam.id },
  });

  console.log("✅ Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
