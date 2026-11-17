import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { getEventCapabilities } from "@/lib/events/eventAccess";

/**
 * GET /api/events/[eventId]/permissions
 * Was der angemeldete Nutzer an diesem Event darf – die Event-Seiten
 * deaktivieren ihre Knöpfe danach. Dieselben Werte prüfen die API-Routen.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const capabilities = await getEventCapabilities(Number(user.cid), Number(eventId));
  if (!capabilities) {
    return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({
    ...capabilities,
    // Bisherige Namen – noch von der Aufgaben-Seite genutzt
    canEdit: capabilities.editDetails,
    canManageTasks: capabilities.manageTasks,
    canBanner: capabilities.banner,
    isTeamMember: capabilities.isTeamMember,
  });
}
