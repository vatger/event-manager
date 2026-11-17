import { isGlobalLevel, type EffectiveLevel, type FirLevel } from "@/lib/acl/effective";
import type { PermissionKey } from "@/lib/acl/catalog";

/**
 * Was darf jemand an einem bestimmten Event?
 *
 * Eine Stelle für Oberfläche und API: Die Event-Seiten deaktivieren ihre
 * Knöpfe nach genau diesen Werten, die Routen prüfen dieselben Werte. So
 * kann kein Knopf mehr aktiv sein, an dem erst „Speichern“ scheitert.
 *
 * Reine Berechnung ohne Datenbankzugriff – geladen wird in eventAccess.ts.
 */

export interface EventCapabilities {
  /** Stammdaten, Status (Planung, Absage), Verantwortliche aller, Aufgaben */
  editDetails: boolean;
  /** Event löschen */
  delete: boolean;
  /** Banner setzen, entfernen, öffentlich schalten */
  banner: boolean;
  /** Anmeldung öffnen, schließen, Anmeldeschluss */
  signupPhase: boolean;
  /** Besetzungsplan veröffentlichen, Roster-Link, Stationsbuchungen */
  publishRoster: boolean;
  /** Besetzungsplan bearbeiten */
  editRoster: boolean;
  /** Anmeldungen anderer anlegen, ändern, löschen */
  manageSignups: boolean;
  /** Anmeldungen exportieren, Sheets-Abgleich */
  export: boolean;
  /** Controller benachrichtigen */
  notify: boolean;
  /** Aufgaben anlegen, zuweisen, löschen */
  manageTasks: boolean;
  /** Andere als Verantwortliche ein- und austragen */
  manageResponsibles: boolean;
  /** Sich selbst als Verantwortlichen ein- und austragen */
  selfAssign: boolean;
  /** Mitglied des Eventdepartments der FIR des Events (oder global) */
  isTeamMember: boolean;
  /** Als Verantwortlicher eingetragen */
  isResponsible: boolean;
  /** Event-Protokoll einsehen */
  viewLog: boolean;
}

export interface EventActor {
  effectiveLevel: EffectiveLevel;
  firScopedPermissions: Record<string, PermissionKey[]>;
  firLevels: Record<string, FirLevel>;
}

export interface EventRelation {
  /** FIR des Events */
  firCode: string | null;
  /** Ist der Nutzer an diesem Event verantwortlich? */
  isResponsible: boolean;
  /** Ist der Nutzer ausdrücklich als Bearbeiter des Besetzungsplans eingetragen? */
  isRosterEditor: boolean;
}

const ALL: EventCapabilities = {
  editDetails: true,
  delete: true,
  banner: true,
  signupPhase: true,
  publishRoster: true,
  editRoster: true,
  manageSignups: true,
  export: true,
  notify: true,
  manageTasks: true,
  manageResponsibles: true,
  selfAssign: true,
  isTeamMember: true,
  isResponsible: false,
  viewLog: true,
};

export function computeEventCapabilities(
  actor: EventActor | null,
  event: EventRelation
): EventCapabilities {
  if (actor && isGlobalLevel(actor.effectiveLevel)) {
    return { ...ALL, isResponsible: event.isResponsible };
  }

  const perms = new Set(
    (actor && event.firCode ? actor.firScopedPermissions[event.firCode] : undefined) ?? []
  );
  const has = (key: PermissionKey) => perms.has(key);
  const isTeamMember = !!actor && !!event.firCode && actor.firLevels[event.firCode] !== undefined;
  const responsible = event.isResponsible;

  const editDetails = has("event.edit");
  const editRoster = has("roster.edit") || responsible || event.isRosterEditor;

  return {
    editDetails,
    delete: has("event.delete"),
    // Verantwortliche dürfen an ihrem Event Banner und Anmeldephase steuern
    banner: has("event.banner") || responsible,
    signupPhase: has("signups.phase") || responsible,
    publishRoster: has("roster.publish"),
    editRoster,
    manageSignups: has("signups.manage") || editRoster,
    export: has("event.export"),
    notify: has("user.notif"),
    manageTasks: editDetails || responsible,
    manageResponsibles: editDetails,
    selfAssign: isTeamMember,
    isTeamMember,
    isResponsible: responsible,
    viewLog: isTeamMember || responsible,
  };
}

/** Klartext je Fähigkeit – für Tooltips an deaktivierten Knöpfen und Fehlermeldungen */
export const CAPABILITY_LABEL: Record<
  Exclude<keyof EventCapabilities, "isTeamMember" | "isResponsible">,
  string
> = {
  editDetails: "Stammdaten bearbeiten",
  delete: "Events löschen",
  banner: "Banner verwalten",
  signupPhase: "Anmeldephase steuern",
  publishRoster: "Besetzungsplan veröffentlichen",
  editRoster: "Besetzungsplan bearbeiten",
  manageSignups: "Anmeldungen verwalten",
  export: "Anmeldungen exportieren",
  notify: "Controller benachrichtigen",
  manageTasks: "Aufgaben verwalten",
  manageResponsibles: "Stammdaten bearbeiten",
  selfAssign: "Mitglied im Eventdepartment",
  viewLog: "Mitglied im Eventdepartment",
};

export type CapabilityKey = keyof typeof CAPABILITY_LABEL;

/** „Dafür brauchst du das Recht …“ – einheitlicher Satz für Oberfläche und API */
export function missingRightMessage(capability: CapabilityKey): string {
  if (capability === "selfAssign" || capability === "viewLog") {
    return "Das ist nur für Mitglieder des Eventdepartments dieser FIR möglich.";
  }
  return `Dafür brauchst du das Recht „${CAPABILITY_LABEL[capability]}“.`;
}
