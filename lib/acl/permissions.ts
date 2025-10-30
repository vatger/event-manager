import prisma from "../prisma";
import { getUserWithEffectiveData } from "./policies";

/**
 * Lädt den User inklusive effektiver Berechtigungen
 * (verwende dies in API-Routen oder Server-Komponenten)
 */
export async function getUserWithPermissions(cid: number) {
  return await getUserWithEffectiveData(cid);
}

/**
 * Prüft, ob ein Nutzer eine bestimmte globale Berechtigung hat
 * @example userHasPermission(1649341, "admin.access")
 */
export async function userHasPermission(cid: number, permissionKey: string) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;

  // MAIN_ADMIN darf alles
  if (user.role === "MAIN_ADMIN") return true;

  return user.effectivePermissions.includes(permissionKey);
}

/**
 * Prüft, ob ein Nutzer eine bestimmte Berechtigung in seiner eigenen FIR hat
 * (z. B. "fir.manage" oder "event.edit")
 * @example userHasFirPermission(1649341, "EDMM", "fir.manage")
 */
export async function userHasFirPermission(
  cid: number,
  firCode: string,
  permissionKey: string
) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;

  if (user.role === "MAIN_ADMIN") return true;
  return user.firScopedPermissions[firCode]?.includes(permissionKey) ?? false;
}

/**
 * Prüft, ob ein Nutzer in seiner eigenen FIR eine bestimmte Berechtigung hat
 * (z. B. fir.manage, event.edit …)
 */
export async function userHasOwnFirPermission(
  cid: number,
  permissionKey: string
) {
  const user = await getUserWithEffectiveData(cid);
  if (!user || !user.fir?.code) return false;

  if (user.role === "MAIN_ADMIN") return true;
  return (
    user.firScopedPermissions[user.fir.code]?.includes(permissionKey) ?? false
  );
}

/**
 * Shortcut für fir.manage – ob der Nutzer seine FIR verwalten darf
 */
export async function canManageFir(cid: number, firCode?: string) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;

  if (user.role === "MAIN_ADMIN") return true;
  if (user.effectiveLevel === "VATGER_LEITUNG") return true;
  
  const code = firCode ?? user.fir?.code;
  if (!code) return false;

  return user.firScopedPermissions[code]?.includes("fir.manage") ?? false;
}

/**
 * Prüft, ob der Nutzer zur VATGER-Eventleitung gehört
 * (d. h. in einer Gruppe mit kind == GLOBAL_VATGER_LEITUNG)
 */
export async function isVatgerEventleitung(cid: number) {
  const user = await prisma.user.findUnique({
    where: { cid },
    include: {
      groups: {
        include: { group: true },
      },
    },
  });

  if (!user) return false;
  if (user.role === "MAIN_ADMIN") return true;

  return user.groups.some(
    (ug) => ug.group.kind === "GLOBAL_VATGER_LEITUNG"
  );
}
