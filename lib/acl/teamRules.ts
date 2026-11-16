import { isGlobalLevel, type EffectiveLevel, type FirLevel } from "./effective";

/**
 * Wer darf im Bereich „Team & Rechte“ was? Reine Regeln ohne Datenbankzugriff –
 * API-Routen und Oberfläche fragen beide hier nach, damit sie nicht
 * auseinanderlaufen.
 *
 *  - Den Bereich sehen und ein Department verwalten: die Leitung der FIR,
 *    die VATGER-Eventleitung und Main-Admins.
 *  - Die Leitungsgruppe (Mitglieder, Name) pflegt nur die VATGER-Eventleitung
 *    bzw. ein Main-Admin. Ihre Rechte sind fest und für niemanden änderbar.
 *  - Die VATGER-Eventleitung ernennt nur ein Main-Admin.
 */

export interface TeamActor {
  effectiveLevel: EffectiveLevel;
  firLevels: Record<string, FirLevel>;
}

export interface TeamGroup {
  kind: string;
  firCode: string;
}

const isLeitungGroup = (group: TeamGroup) => group.kind === "FIR_LEITUNG";

/** Darf der Nutzer das Department dieser FIR einsehen und seine Untergruppen verwalten? */
export function canManageDepartment(actor: TeamActor, firCode: string): boolean {
  if (isGlobalLevel(actor.effectiveLevel)) return true;
  return actor.firLevels[firCode] === "FIR_EVENTLEITER";
}

/** FIRs, deren Department der Nutzer verwalten darf ("ALL" = jede). */
export function manageableDepartments(actor: TeamActor): "ALL" | string[] {
  if (isGlobalLevel(actor.effectiveLevel)) return "ALL";
  return Object.entries(actor.firLevels)
    .filter(([, level]) => level === "FIR_EVENTLEITER")
    .map(([code]) => code);
}

/** Hat der Nutzer überhaupt Zugang zum Bereich „Team & Rechte“? */
export function canAccessTeamArea(actor: TeamActor): boolean {
  const scope = manageableDepartments(actor);
  return scope === "ALL" || scope.length > 0;
}

/** Untergruppen anlegen */
export function canCreateGroup(actor: TeamActor, firCode: string): boolean {
  return canManageDepartment(actor, firCode);
}

/** Name und Beschreibung einer Gruppe ändern */
export function canEditGroup(actor: TeamActor, group: TeamGroup): boolean {
  if (!canManageDepartment(actor, group.firCode)) return false;
  return !isLeitungGroup(group) || isGlobalLevel(actor.effectiveLevel);
}

/** Gruppe löschen – die Leitungsgruppe ist für niemanden löschbar */
export function canDeleteGroup(actor: TeamActor, group: TeamGroup): boolean {
  return !isLeitungGroup(group) && canManageDepartment(actor, group.firCode);
}

/** Rechte einer Gruppe ändern – die der Leitungsgruppe sind fest */
export function canEditGroupPermissions(actor: TeamActor, group: TeamGroup): boolean {
  return !isLeitungGroup(group) && canManageDepartment(actor, group.firCode);
}

/** Mitglieder hinzufügen und entfernen */
export function canManageGroupMembers(actor: TeamActor, group: TeamGroup): boolean {
  if (!canManageDepartment(actor, group.firCode)) return false;
  return !isLeitungGroup(group) || isGlobalLevel(actor.effectiveLevel);
}

/** Die Liste der VATGER-Eventleitung einsehen */
export function canViewVatgerLeitung(actor: TeamActor): boolean {
  return isGlobalLevel(actor.effectiveLevel);
}

/** Die VATGER-Eventleitung ernennen und abberufen */
export function canManageVatgerLeitung(actor: TeamActor): boolean {
  return actor.effectiveLevel === "MAIN_ADMIN";
}
