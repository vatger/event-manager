import prisma from "@/lib/prisma";
import { apiJson, principalMayAccessFir, requireApiPrincipal } from "@/lib/api/apiAuth";
import { buildPublicRoster } from "@/lib/roster/publicRoster";
import { canViewEventRoster } from "@/lib/roster/rosterPermissions";

/**
 * GET /api/v1/events/{id}/roster
 *
 * Der komplette Besetzungsplan eines Events: Stationen in der Reihenfolge
 * des Editors und alle Schichten mit Lotse (CID, Name), Station und Zeiten,
 * dazu Custom-Blöcke und persönliche Blöcke wie „Mentor".
 * Anmeldung: Session oder `Authorization: Bearer <API-Token>`.
 *
 * Ausgeliefert wird die veröffentlichte Fassung. `?version=live` liefert den
 * Arbeitsstand – nur für angemeldete Nutzer, die den Plan im Editor sehen
 * dürfen, nie für Tokens.
 *
 * Nie enthalten: interne Notizen, Markierungen, Bemerkungen und
 * Nichtverfügbarkeiten der Lotsen.
 */
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requireApiPrincipal(req);
  if ("response" in auth) return auth.response;
  const { principal } = auth;

  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isSafeInteger(id) || id <= 0) return apiJson({ error: "Invalid event id" }, 400);

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, status: true, firCode: true },
  });
  // Entwürfe gibt es für die API nicht – auch nicht als 403, damit sich ihre
  // IDs nicht abtasten lassen
  if (!event || event.status === "DRAFT") return apiJson({ error: "Event not found" }, 404);
  if (!principalMayAccessFir(principal, event.firCode)) {
    return apiJson({ error: "Event not found" }, 404);
  }

  const version = new URL(req.url).searchParams.get("version") ?? "published";
  if (version !== "published" && version !== "live") {
    return apiJson({ error: "version must be 'published' or 'live'" }, 400);
  }
  const live = version === "live";
  if (live && (principal.kind !== "session" || !(await canViewEventRoster(principal.cid, id)))) {
    return apiJson({ error: "Live version requires roster access" }, 403);
  }

  const result = await buildPublicRoster(id, live);
  if (!result) return apiJson({ error: "Event not found" }, 404);

  const base = {
    event: {
      id: result.event.id,
      name: result.event.name,
      firCode: result.event.firCode,
      status: event.status,
      startTime: result.event.startTime.toISOString(),
      endTime: result.event.endTime.toISOString(),
    },
    version,
    published: result.published,
    publishedAt: result.publishedAt?.toISOString() ?? null,
  };

  if (!result.roster) {
    return apiJson({ ...base, briefing: result.briefing, stations: [], shifts: [] });
  }

  const roster = result.roster;
  const callsignById = new Map(roster.stations.map((s) => [s.id, s.callsign]));
  return apiJson({
    ...base,
    briefing: result.briefing,
    slotMinutes: roster.slotMinutes,
    stations: roster.stations.map((s, order) => ({ callsign: s.callsign, order })),
    shifts: roster.assignments
      .map((a) => ({
        station: a.stationId !== null ? callsignById.get(a.stationId) ?? null : null,
        type: a.type,
        cid: a.type === "custom" ? null : a.userCID,
        name: a.name,
        label: a.label,
        start: a.startTime,
        end: a.endTime,
      }))
      .sort((a, b) => a.start.localeCompare(b.start) || (a.station ?? "").localeCompare(b.station ?? "")),
  });
}
