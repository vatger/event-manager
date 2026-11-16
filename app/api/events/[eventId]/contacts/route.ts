import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { getEventContacts } from "@/lib/events/eventContacts";

/**
 * GET /api/events/[eventId]/contacts
 *
 * Namen der Ansprechpartner für Abmeldungen nach dem Anmeldeschluss
 * (Eventverantwortliche + roster.contact) – für die vorbereitete Forum-PN.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const contacts = await getEventContacts(id);
  return NextResponse.json({ contacts: contacts.map((c) => ({ name: c.name })) });
}
