// prisma/seed.ts
import { PrismaClient, PermissionScope, Role } from "@prisma/client";
const prisma = new PrismaClient();

async function ensurePermission(key: string, description?: string) {
  return prisma.permission.upsert({
    where: { key },
    update: { description },
    create: { key, description },
  });
}

async function ensureGroup(name: string, firId?: number, description?: string) {
  if (firId == null) {
    // Global group (kein FIR)
    const existing = await prisma.group.findFirst({ where: { name, firId: null } });
    if (existing) {
      return prisma.group.update({
        where: { id: existing.id },
        data: { description },
      });
    }
    return prisma.group.create({
      data: { name, description, firId: null },
    });
  } else {
    // FIR-gebundene Gruppe: normaler Upsert
    return prisma.group.upsert({
      where: { name_firId: { name, firId } },
      update: { description },
      create: { name, description, firId },
    });
  }
}



async function addPermissionToGroup(groupId: number, permissionKey: string, scope: PermissionScope) {
  const perm = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!perm) throw new Error(`Permission not found: ${permissionKey}`);
  await prisma.groupPermission.upsert({
    where: {
      groupId_permissionId_scope: { groupId, permissionId: perm.id, scope },
    },
    update: {},
    create: { groupId, permissionId: perm.id, scope },
  });
}

async function main() {
  // 1) Standard-Permissions
  const perms = [
    ["admin.access", "Adminbereich öffnen"],
    ["group.manage", "Gruppen & Mitglieder verwalten"],
    ["event.create", "Events erstellen"],
    ["event.edit", "Events bearbeiten"],
    ["event.delete", "Events löschen"],
    ["roster.publish", "Roster veröffentlichen"],
  ] as const;

  for (const [key, desc] of perms) {
    await ensurePermission(key, desc);
  }

  // 2) Beispiel-FIR (EDMM)
  const edmm = await prisma.fIR.upsert({
    where: { code: "EDMM" },
    update: { name: "München FIR" },
    create: { code: "EDMM", name: "München FIR" },
  });

  // 3) Default-Gruppen pro FIR
  const edmmEventTeam = await ensureGroup("EDMM Event Team", edmm.id, "Eventler der FIR EDMM");
  const edmmLeitung   = await ensureGroup("EDMM Leitung", edmm.id, "FIR Eventleitung");

  // EDMM Event Team: eigene FIR Events verwalten
  for (const key of ["admin.access","event.create","event.edit","event.delete"]) {
    await addPermissionToGroup(edmmEventTeam.id, key, PermissionScope.OWN_FIR);
  }
  await addPermissionToGroup(edmmEventTeam.id, "roster.publish", PermissionScope.OWN_FIR);

  // EDMM Leitung: eigene FIR + Team verwalten
  for (const key of ["admin.access","group.manage","event.create","event.edit","event.delete","roster.publish"]) {
    await addPermissionToGroup(edmmLeitung.id, key, PermissionScope.OWN_FIR);
  }

  // 4) Global: Main Admins Group (optional, wenn du MAINADMIN via Role schon nutzt)
  const mainAdmins = await ensureGroup("Main Admins", undefined, "Systemweite Admins");
  for (const key of perms.map(([k]) => k)) {
    await addPermissionToGroup(mainAdmins.id, key, PermissionScope.ALL);
  }

  // 5) Deinen User als MAINADMIN markieren (CID anpassen!)
  const ME = await prisma.user.upsert({
    where: { cid: 1649341 },
    update: { name: "Yannik Schäffler", rating: "C1", role: Role.MAIN_ADMIN },
    create: { cid: 1649341, name: "Yannik Schäffler", rating: "S3", role: Role.MAIN_ADMIN },
  });

  // (optional) Dich auch in Main Admins Gruppe aufnehmen (für einheitliche Checks)
  await prisma.userGroup.upsert({
    where: { userCID_groupId: { userCID: ME.cid, groupId: mainAdmins.id } },
    update: {},
    create: { userCID: ME.cid, groupId: mainAdmins.id },
  });
  

  console.log("✅ Seed done.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
