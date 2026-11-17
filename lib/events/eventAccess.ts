import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserWithEffectiveData } from "@/lib/acl/policies";
import {
  computeEventCapabilities,
  missingRightMessage,
  type CapabilityKey,
  type EventCapabilities,
} from "./eventCapabilities";

/**
 * Lädt alles, was für die Rechte an einem Event nötig ist, in einem Zug:
 * Rollen des Nutzers, FIR des Events, Verantwortung, Roster-Bearbeiter.
 */
export async function getEventCapabilities(
  cid: number,
  eventId: number
): Promise<EventCapabilities | null> {
  const [actor, event, responsible, rosterEditor] = await Promise.all([
    getUserWithEffectiveData(cid),
    prisma.event.findUnique({ where: { id: eventId }, select: { firCode: true } }),
    prisma.eventResponsible.findUnique({
      where: { eventId_userCID: { eventId, userCID: cid } },
      select: { id: true },
    }),
    prisma.eventRosterEditor.findFirst({
      where: { userCID: cid, roster: { eventId } },
      select: { id: true },
    }),
  ]);
  if (!event) return null;

  return computeEventCapabilities(actor, {
    firCode: event.firCode,
    isResponsible: !!responsible,
    isRosterEditor: !!rosterEditor,
  });
}

/**
 * Antwort für fehlende Rechte – oder null, wenn alles da ist. Nennt das
 * erste fehlende Recht im selben Wortlaut wie die Oberfläche.
 */
export function denyMissing(
  capabilities: EventCapabilities,
  required: CapabilityKey[]
): NextResponse | null {
  const missing = required.find((key) => !capabilities[key]);
  if (!missing) return null;
  return NextResponse.json(
    { error: missingRightMessage(missing), missing },
    { status: 403 }
  );
}
