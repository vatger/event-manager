import { prisma } from "@/lib/prisma";
import { getUserWithEffectiveData } from "./policies";
import { isMainAdminCid } from "./mainAdmins";

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
  if (user.effectiveLevel === "MAIN_ADMIN") return true;
  if (user.effectivePermissions.includes("*")) return true;
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
  if (user.effectivePermissions.includes("*")) return true;
  if (user.effectiveLevel === "MAIN_ADMIN") return true;
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
  if (user.effectivePermissions.includes("*")) return true;
  if (user.effectiveLevel === "MAIN_ADMIN") return true;
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

  if (user.effectiveLevel === "MAIN_ADMIN") return true;
  if (user.effectiveLevel === "VATGER_LEITUNG") return true;
  
  const code = firCode ?? user.fir?.code;
  if (!code) return false;

  return user.firLevels[code] == "FIR_EVENTLEITER";
}

/**
 * Prüft, ob der Nutzer zur VATGER-Eventleitung gehört
 * (d. h. in einer Gruppe mit kind == GLOBAL_VATGER_LEITUNG)
 */
export async function isVatgerEventleitung(cid: number) {
  // MAIN_ADMIN is exclusively determined by the MAIN_ADMIN_CIDS env variable
  if (isMainAdminCid(cid)) return true;

  // Prüfen, ob User in der Tabelle 'VatgerLeitung' ist
  const isInVatgerLeitungTable = await prisma.vATGERLeitung.findUnique({
    where: { userCID: cid },
  });

  return !!isInVatgerLeitungTable;
}


/**
 * Hilfsfunktion ob zu prüfen ob ein Nutzer die Brechtigungen an einem
 * Event hat (userHasFirPermission shortcut)
 * @example userhasPermissiononEvent(1649341, 1, "roster.publish")
 */
export async function userhasPermissiononEvent(cid: number, eventId: number, permission: string){
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { firCode: true }
  })
  if(await isVatgerEventleitung(cid)) return true
  if(!event?.firCode) return false
  return await userHasFirPermission(cid, event?.firCode, permission)
}

/**
 * Prüft, ob ein Nutzer Admin-Zugriff hat
 * (d. h. in einer Gruppe ist oder MAIN_ADMIN ist)
 */
export async function hasAdminAccess(cid: number) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;

  if (user.effectiveLevel === "MAIN_ADMIN") return true;
  if (user.effectiveLevel === "VATGER_LEITUNG") return true;
  if(user.groups && user.groups.length > 0) return true;

  return false
  
}
