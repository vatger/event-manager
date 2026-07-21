import { prisma } from "@/lib/prisma";
import {
  isVatgerEventleitung,
  userHasFirPermission,
  isEventResponsible,
  isEventFirTeamMember,
  userhasPermissiononEvent,
} from "@/lib/acl/permissions";

/**
 * Zentrale Berechtigungslogik für den Besetzungsplan-Editor.
 *
 * Ansehen:   jeder, der das Event intern sehen kann (FIR-Team-Mitglied) oder bearbeiten darf.
 * Bearbeiten: VATGER-Leitung, event.edit, die neue FIR-Permission roster.edit,
 *             Event-Verantwortliche oder explizit als Roster-Bearbeiter eingetragene Nutzer.
 * Bearbeiter verwalten: VATGER-Leitung, event.edit oder Event-Verantwortliche.
 * Signups verwalten: signups.manage ODER Roster-Bearbeiter (damit man Anmeldungen
 *             direkt aus dem Editor pflegen kann).
 */

async function getEventFir(eventId: number): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { firCode: true },
  });
  return event?.firCode ?? null;
}

/** Ist der Nutzer explizit als Roster-Bearbeiter für dieses Event eingetragen? */
async function isExplicitRosterEditor(cid: number, eventId: number): Promise<boolean> {
  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!roster) return false;
  const editor = await prisma.eventRosterEditor.findUnique({
    where: { rosterId_userCID: { rosterId: roster.id, userCID: cid } },
    select: { id: true },
  });
  return !!editor;
}

/** Darf der Nutzer den Besetzungsplan dieses Events bearbeiten? */
export async function canEditEventRoster(cid: number, eventId: number): Promise<boolean> {
  if (await isVatgerEventleitung(cid)) return true;

  const fir = await getEventFir(eventId);
  if (fir) {
    if (await userHasFirPermission(cid, fir, "event.edit")) return true;
    if (await userHasFirPermission(cid, fir, "roster.edit")) return true;
  }
  if (await isEventResponsible(cid, eventId)) return true;
  if (await isExplicitRosterEditor(cid, eventId)) return true;
  return false;
}

/** Darf der Nutzer den Besetzungsplan ansehen (auch ohne Bearbeitungsrecht)? */
export async function canViewEventRoster(cid: number, eventId: number): Promise<boolean> {
  if (await canEditEventRoster(cid, eventId)) return true;
  if (await isEventFirTeamMember(cid, eventId)) return true;
  return false;
}

/** Darf der Nutzer die Liste der Roster-Bearbeiter verwalten? */
export async function canManageRosterEditors(cid: number, eventId: number): Promise<boolean> {
  if (await isVatgerEventleitung(cid)) return true;
  const fir = await getEventFir(eventId);
  if (fir && (await userHasFirPermission(cid, fir, "event.edit"))) return true;
  if (await isEventResponsible(cid, eventId)) return true;
  return false;
}

/**
 * Darf der Nutzer Anmeldungen dieses Events verwalten (anlegen/ändern/löschen für andere)?
 * signups.manage ODER Roster-Bearbeitungsrecht.
 */
export async function canManageEventSignups(cid: number, eventId: number): Promise<boolean> {
  if (await userhasPermissiononEvent(cid, eventId, "signups.manage")) return true;
  if (await canEditEventRoster(cid, eventId)) return true;
  return false;
}
