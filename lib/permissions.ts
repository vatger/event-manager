import prisma from "@/lib/prisma";
import { getOrSetCache } from "@/lib/cache";

/**
 * Prüft, ob ein Benutzer eine bestimmte Berechtigung hat
 */
export async function userHasPermission(cid: number, permissionKey: string, firId?: number): Promise<boolean> {
  if (!cid || !permissionKey) return false;

  // 🔹 Cache verwenden, um DB-Last zu reduzieren
  const cacheKey = `user:${cid}:perm:${permissionKey}${firId ? `:fir:${firId}` : ""}`;
  return await getOrSetCache(cacheKey, async () => {
    // 🔹 User holen (mit minimalem Include)
    const user = await prisma.user.findUnique({
      where: { cid },
      include: {
        groups: {
          include: {
            group: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return false;

    // 🔹 Main Admin darf immer alles
    if (user.role === "MAIN_ADMIN") return true;

    // 🔹 Durch Gruppen iterieren
    for (const ug of user.groups) {
      for (const gp of ug.group.permissions) {
        const p = gp.permission;
        if (!p) continue;

        // Match Permission Key
        if (p.key === permissionKey) {
          // Optional: FIR prüfen
          if (!firId) return true;
        }
      }
    }
    return false;
  }, 60); // Cache 1 Minuten
}
