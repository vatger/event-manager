import type { PrismaClient } from "@prisma/client";
import { LEGACY_PERMISSION_ALIASES, PERMISSION_CATALOG } from "./catalog";

/**
 * Gleicht die Tabelle `Permission` mit dem Katalog im Code ab:
 * fehlende Rechte anlegen, Beschriftungen angleichen, Vergaben alter
 * Schlüssel auf ihren Ersatz umhängen und Rechte außerhalb des Katalogs
 * entfernen. Wiederholbar – läuft beim Serverstart und im Seed.
 */
export async function syncPermissionCatalog(db: PrismaClient): Promise<void> {
  for (const def of PERMISSION_CATALOG) {
    await db.permission.upsert({
      where: { key: def.key },
      update: { description: def.label },
      create: { key: def.key, description: def.label },
    });
  }

  for (const [legacyKey, targetKey] of Object.entries(LEGACY_PERMISSION_ALIASES)) {
    const legacy = await db.permission.findUnique({
      where: { key: legacyKey },
      include: { groups: true },
    });
    if (!legacy) continue;
    const target = await db.permission.findUniqueOrThrow({ where: { key: targetKey } });
    for (const grant of legacy.groups) {
      await db.groupPermission.upsert({
        where: { groupId_permissionId: { groupId: grant.groupId, permissionId: target.id } },
        update: {},
        create: { groupId: grant.groupId, permissionId: target.id },
      });
    }
  }

  // Vergaben hängen per CASCADE an ihrem Recht
  await db.permission.deleteMany({
    where: { key: { notIn: PERMISSION_CATALOG.map((def) => def.key) } },
  });
}
