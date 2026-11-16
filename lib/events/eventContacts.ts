import prisma from "@/lib/prisma";

/**
 * Ansprechpartner eines Events für Abmeldungen nach dem Anmeldeschluss.
 *
 * Nach dem Anmeldeschluss meldet sich niemand mehr per Klick ab, sondern
 * schreibt eine PN im Forum. Empfänger sind:
 *
 * - die Verantwortlichen des Events,
 * - wer in der FIR des Events einer Gruppe mit dem Recht `roster.contact`
 *   angehört.
 *
 * Bewusst nur ausdrücklich vergebene Rechte: Weder die Leitungsgruppe noch
 * VATGER-Eventleitung oder Main-Admins stehen automatisch in jeder PN.
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

  const groups = event.fir
    ? await prisma.group.findMany({
        where: {
          firId: event.fir.id,
          permissions: { some: { permission: { key: "roster.contact" } } },
        },
        select: { members: { select: { user: { select: { cid: true, name: true } } } } },
      })
    : [];

  const byCid = new Map<number, string>();
  for (const r of event.responsibles) byCid.set(r.user.cid, r.user.name);
  for (const g of groups) for (const m of g.members) byCid.set(m.user.cid, m.user.name);

  return [...byCid.entries()]
    .map(([cid, name]) => ({ cid, name }))
    .filter((c) => c.name && c.name !== "Unbekannt");
}
