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

  // MAIN_ADMIN darf alles
  if (user.role === "MAIN_ADMIN") return true;

  return user.firScopedPermissions[firCode]?.includes(permissionKey) ?? false;
}

/**
 * Prüft, ob ein Nutzer eine FIR verwalten darf (Abkürzung)
 * @example canManageFir(1649341, "EDMM")
 */
export async function canManageFir(cid: number, firCode: string) {
  return await userHasFirPermission(cid, firCode, "fir.manage");
}
