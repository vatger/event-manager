import { prisma } from "@/lib/prisma";
import { getUserWithEffectiveData } from "./policies";
import { isMainAdminCid } from "./mainAdmins";
import type { PermissionKey } from "./catalog";
import { canManageDepartment } from "./teamRules";

/**
 * Lädt den User inklusive effektiver Berechtigungen
 * (verwende dies in API-Routen oder Server-Komponenten)
 */
export async function getUserWithPermissions(cid: number) {
  return await getUserWithEffectiveData(cid);
}

/**
 * Prüft, ob ein Nutzer ein Recht in einer FIR hat. Rechte gelten immer je FIR;
 * VATGER-Eventleitung und Main-Admins haben jedes Recht in jeder FIR.
 * @example userHasFirPermission(1649341, "EDMM", "event.edit")
 */
export async function userHasFirPermission(
  cid: number,
  firCode: string,
  permissionKey: PermissionKey
) {
  return userHasAnyFirPermission(cid, firCode, [permissionKey]);
}

/**
 * Hat der Nutzer in der FIR mindestens eine der Berechtigungen? Eine einzige
 * Abfrage statt einer je Berechtigung.
 */
export async function userHasAnyFirPermission(
  cid: number,
  firCode: string,
  permissionKeys: PermissionKey[]
) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  if (user.effectivePermissions.includes("*")) return true;
  const scoped = user.firScopedPermissions[firCode] ?? [];
  return permissionKeys.some((key) => scoped.includes(key));
}

/**
 * Prüft, ob ein Nutzer in seiner eigenen FIR eine bestimmte Berechtigung hat.
 */
export async function userHasOwnFirPermission(
  cid: number,
  permissionKey: PermissionKey
) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  if (user.effectivePermissions.includes("*")) return true;
  if (!user.fir?.code) return false;
  return user.firScopedPermissions[user.fir.code]?.includes(permissionKey) ?? false;
}

/**
 * Darf der Nutzer das Eventdepartment einer FIR verwalten (Untergruppen,
 * Mitglieder, Rechte)? Ohne FIR-Code ist die eigene FIR gemeint.
 */
export async function canManageFir(cid: number, firCode?: string) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;

  const code = firCode ?? user.fir?.code;
  if (!code) return user.effectivePermissions.includes("*");
  return canManageDepartment(user, code);
}

/**
 * Prüft, ob der Nutzer zur VATGER-Eventleitung gehört (Tabelle VATGERLeitung).
 * Main-Admins zählen dazu.
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
export async function userhasPermissiononEvent(cid: number, eventId: number, permission: PermissionKey){
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { firCode: true }
  })
  if(await isVatgerEventleitung(cid)) return true
  if(!event?.firCode) return false
  return await userHasFirPermission(cid, event?.firCode, permission)
}

/**
 * Prüft, ob ein Nutzer Zugriff auf ein bestimmtes Weekly Event hat.
 * Gibt true wenn:
 *   - MAIN_ADMIN / VATGER_LEITUNG
 *   - FIR-weite event.edit-Berechtigung für das FIR des Weeklys
 *   - Als WeeklyEventManager für genau dieses Weekly eingetragen
 */
export async function userCanManageWeekly(cid: number, configId: number): Promise<boolean> {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  if (user.effectivePermissions.includes("*")) return true;

  // Load config to check FIR
  const config = await prisma.weeklyEventConfiguration.findUnique({
    where: { id: configId },
    include: { fir: true },
  });

  // FIR-level permission
  if (config?.fir?.code &&
      (user.firScopedPermissions[config.fir.code]?.includes("event.edit") ?? false)) {
    return true;
  }

  // Weekly-specific manager role
  const manager = await prisma.weeklyEventManager.findUnique({
    where: { userCID_configId: { userCID: cid, configId } },
  });
  return !!manager;
}

/**
 * Prüft, ob ein Nutzer zum Eventdepartment der FIR des Events gehört (Mitglied
 * irgendeiner Gruppe dieser FIR). Teammitglieder können sich Tasks claimen und
 * als erledigt markieren.
 */
export async function isEventFirTeamMember(cid: number, eventId: number): Promise<boolean> {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  if (user.effectivePermissions.includes("*")) return true;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { firCode: true },
  });
  if (!event?.firCode) return false;

  return user.firLevels[event.firCode] !== undefined;
}

/**
 * Prüft, ob ein Nutzer Verantwortlicher des Events ist.
 */
export async function isEventResponsible(cid: number, eventId: number): Promise<boolean> {
  const entry = await prisma.eventResponsible.findUnique({
    where: { eventId_userCID: { eventId, userCID: cid } },
  });
  return !!entry;
}

/**
 * Prüft, ob ein Nutzer Tasks für ein Event verwalten darf.
 * Event-Verantwortliche und FIR-Eventleiter können:
 *   - Tasks erstellen, bearbeiten, löschen
 *   - Tasks anderen zuweisen
 *   - Tasks als erledigt/übersprungen markieren
 */
export async function canManageEventTasks(cid: number, eventId: number): Promise<boolean> {
  if (await userhasPermissiononEvent(cid, eventId, "event.edit")) return true;
  if (await isEventResponsible(cid, eventId)) return true;
  return false;
}

/**
 * Prüft, ob ein Nutzer den Banner eines Events verwalten darf (show/hide).
 * Benötigt event.edit, event.banner ODER ist Event-Verantwortlicher.
 */
export async function canManageEventBanner(cid: number, eventId: number): Promise<boolean> {
  if (await userhasPermissiononEvent(cid, eventId, "event.edit")) return true;
  if (await userhasPermissiononEvent(cid, eventId, "event.banner")) return true;
  if (await isEventResponsible(cid, eventId)) return true;
  return false;
}

/**
 * Prüft, ob ein Nutzer Admin-Zugriff hat (Mitglied eines FIR-Eventdepartments,
 * VATGER-Eventleitung, Main-Admin oder Weekly-Manager)
 */
export async function hasAdminAccess(cid: number) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;

  if (user.effectivePermissions.includes("*")) return true;
  if (Object.keys(user.firLevels).length > 0) return true;

  // Weekly managers also need admin access to reach the roster editor
  const isWeeklyManager = await prisma.weeklyEventManager.findFirst({
    where: { userCID: cid },
  });
  return !!isWeeklyManager;
}

/** Prüft, ob ein Nutzer zur Leitungsgruppe einer FIR gehört */
export async function isFIRLead(cid: number) {
  const user = await getUserWithEffectiveData(cid);
  if (!user) return false;
  return Object.values(user.firLevels).includes("FIR_EVENTLEITER");
}
