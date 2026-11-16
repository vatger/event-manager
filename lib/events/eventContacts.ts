import prisma from "@/lib/prisma";

/**
 * Ansprechpartner eines Events für Abmeldungen nach dem Anmeldeschluss.
 *
 * Nach dem Anmeldeschluss meldet sich niemand mehr per Klick ab, sondern
 * schreibt eine PN im Forum. Empfänger sind:
 *
 * - die Verantwortlichen des Events,
 * - wer in der FIR des Events die Berechtigung `roster.contact` hat (oder
 *   sie FIR-übergreifend mit Scope ALL bekommen hat).
 *
 * Bewusst nur ausdrücklich vergebene Rechte: Hauptadmins mit „*" sollen
 * nicht in jeder PN stehen.
 */
export async function getEventContacts(eventId: number): Promise<{ cid: number; name: string }[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      fir: { select: { id: true } },
      responsibles: { select: { user: { select: { cid: true, name: true } } } },
    },
  });
  if (!event) return [];

  const contactPermission = (scope: "OWN_FIR" | "ALL") => ({
    some: { permission: { key: "roster.contact" }, scope },
  });
  const groups = await prisma.group.findMany({
    where: {
      OR: [
        ...(event.fir ? [{ firId: event.fir.id, permissions: contactPermission("OWN_FIR") }] : []),
        { permissions: contactPermission("ALL") },
      ],
    },
    select: { members: { select: { user: { select: { cid: true, name: true } } } } },
  });

  const byCid = new Map<number, string>();
  for (const r of event.responsibles) byCid.set(r.user.cid, r.user.name);
  for (const g of groups) for (const m of g.members) byCid.set(m.user.cid, m.user.name);

  return [...byCid.entries()]
    .map(([cid, name]) => ({ cid, name }))
    .filter((c) => c.name && c.name !== "Unbekannt");
}
