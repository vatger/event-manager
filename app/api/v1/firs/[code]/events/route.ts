import prisma from "@/lib/prisma";
import {
  apiJson,
  principalMayAccessFir,
  principalMaySeeDrafts,
  requireApiPrincipal,
} from "@/lib/api/apiAuth";
import { publicUrl } from "@/lib/api/publicUrl";

/**
 * GET /api/v1/firs/{code}/events
 *
 * Alle Events einer FIR, nach Beginn sortiert. Entwürfe nur für Tokens mit
 * „Entwürfe einschließen“ und für Nutzer, die für die FIR zuständig sind.
 * Anmeldung: Session oder `Authorization: Bearer <API-Token>`.
 *
 * Optionale Filter (ISO-8601): `from` – Events, die danach enden;
 * `to` – Events, die davor beginnen.
 */
const MAX_EVENTS = 500;

function parseDate(value: string | null): Date | null | "invalid" {
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireApiPrincipal(req);
  if ("response" in auth) return auth.response;

  const { code: rawCode } = await params;
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return apiJson({ error: "Invalid FIR code" }, 400);
  if (!principalMayAccessFir(auth.principal, code)) {
    return apiJson({ error: "Token is not valid for this FIR" }, 403);
  }

  const { searchParams } = new URL(req.url);
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  if (from === "invalid" || to === "invalid") {
    return apiJson({ error: "from/to must be ISO-8601 dates" }, 400);
  }

  const fir = await prisma.fIR.findUnique({ where: { code }, select: { code: true, name: true } });
  if (!fir) return apiJson({ error: "FIR not found" }, 404);

  const includesDrafts = await principalMaySeeDrafts(auth.principal, code);

  const events = await prisma.event.findMany({
    where: {
      firCode: code,
      ...(includesDrafts ? {} : { status: { not: "DRAFT" as const } }),
      ...(from ? { endTime: { gte: from } } : {}),
      ...(to ? { startTime: { lte: to } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startTime: true,
      endTime: true,
      signupDeadline: true,
      airports: true,
      staffedStations: true,
      _count: { select: { signups: { where: { deletedAt: null } } } },
    },
    orderBy: { startTime: "asc" },
    take: MAX_EVENTS,
  });

  return apiJson({
    fir: { code: fir.code, name: fir.name },
    includesDrafts,
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      status: e.status,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      signupDeadline: e.signupDeadline?.toISOString() ?? null,
      airports: stringList(e.airports),
      stations: stringList(e.staffedStations),
      signupCount: e._count.signups,
      rosterPublished: e.status === "ROSTER_PUBLISHED",
      url: publicUrl(`/events/${e.id}`),
      rosterApiUrl: publicUrl(`/api/v1/events/${e.id}/roster`),
    })),
  });
}
