import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isMainAdminCid } from "./mainAdmins";

export type UserWithAll = Prisma.UserGetPayload<{
  include: {
    fir: true;
    vatgerLeitung: true;
    groups: {
      include: {
        group: {
          include: {
            fir: true;
            permissions: { include: { permission: true } };
          };
        };
      };
    };
  };
}>;

export interface EffectiveData {
  effectivePermissions: string[];
  firScopedPermissions: Record<string, string[]>;
  effectiveLevel: "USER" | "FIR_EVENTLEITER" | "VATGER_LEITUNG" | "MAIN_ADMIN";
  firLevels: Record<string, "FIR_EVENTLEITER" | "FIR_TEAM">;
}

/** zentrale Berechnung aller Rechte / Rollen eines Users */
export function computeEffectiveData(user: UserWithAll): EffectiveData {
  const effectivePermissions = new Set<string>();
  const firScopedPermissions: Record<string, string[]> = {};
  const firLevels: Record<string, "FIR_EVENTLEITER" | "FIR_TEAM"> = {};

  let effectiveLevel: EffectiveData["effectiveLevel"] = "USER";

  // MAIN_ADMIN → alles (determined exclusively by MAIN_ADMIN_CIDS env variable)
  if (isMainAdminCid(user.cid)) {
    effectiveLevel = "MAIN_ADMIN";
    [
      "*",
    ].forEach((p) => effectivePermissions.add(p));
  }

  // Gruppen durchlaufen
  for (const ug of user.groups) {
    const group = ug.group;
    if (!group) continue;

    // Rollen nach GroupKind
    if (group.fir?.code) {
      if (group.kind === "FIR_LEITUNG")
        firLevels[group.fir.code] = "FIR_EVENTLEITER";
      else if (
        group.kind === "FIR_TEAM" &&
        firLevels[group.fir.code] !== "FIR_EVENTLEITER"
      )
        firLevels[group.fir.code] = "FIR_TEAM";
    }

    // Permissions aus GroupPermissions
    for (const gp of group.permissions) {
      const key = gp.permission.key;
      if (gp.scope === "ALL" || !group.fir) {
        effectivePermissions.add(key);
      } else if (gp.scope === "OWN_FIR" && group.fir?.code) {
        const firCode = group.fir.code;
        (firScopedPermissions[firCode] ??= []).push(key);
      }
    }
  }

  // globale Level bestimmen
  if (isMainAdminCid(user.cid)) {
    effectiveLevel = "MAIN_ADMIN";
  } else if (
    Object.values(firLevels).includes("FIR_EVENTLEITER") &&
    effectiveLevel !== "MAIN_ADMIN"
  ) {
    effectiveLevel = "FIR_EVENTLEITER";
  }
  if (user.vatgerLeitung) {
    effectiveLevel = "VATGER_LEITUNG";
    effectivePermissions.add("*");
  }

  return {
    effectivePermissions: Array.from(effectivePermissions),
    firScopedPermissions,
    effectiveLevel,
    firLevels,
  };
}

/** Helper zum Laden und Berechnen */
export async function getUserWithEffectiveData(cid: number) {
  const user = await prisma.user.findUnique({
    where: { cid },
    include: {
      fir: true,
      vatgerLeitung: true,
      groups: {
        include: {
          group: {
            include: {
              fir: true,
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return null;
  const data = computeEffectiveData(user);
  return { ...user, ...data };
}
