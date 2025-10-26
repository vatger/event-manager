import prisma from "@/lib/prisma";

export async function userHasPermission(userCid: number, permissionKey: string, firId?: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { cid: userCid },
    include: {
      groups: {
        include: {
          group: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!user) return false;

  // Main Admins dürfen alles
  if (user.role === "MAIN_ADMIN") return true;

  for (const ug of user.groups) {
    for (const gp of ug.group.permissions) {
      const perm = gp.permission;
      if (perm.key !== permissionKey) continue;

      if (gp.scope === "ALL") return true;
      if (gp.scope === "OWN_FIR" && user.firId && firId && user.firId === firId) return true;
    }
  }

  return false;
}
