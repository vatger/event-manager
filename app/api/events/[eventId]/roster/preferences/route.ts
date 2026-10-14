import { NextRequest, NextResponse } from "next/server";
import { isValidId } from "@/lib/roster/solver/api";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster, canViewEventRoster } from "@/lib/roster/eventRosterService";
import { logRosterActivity } from "@/lib/roster/rosterActivity";
import { isEmptyPreference, toControllerPreference } from "@/lib/roster/solver/preferences";


// Erst trimmen, dann prüfen – sonst ginge "   " als Callsign durch
const callsigns = z
  .array(z.string().trim().min(3).max(20))
  .max(40)
  .transform((list) => [...new Set(list.map((c) => c.toUpperCase()))]);

const preferenceSchema = z.object({
  userCID: z.number().int().positive(),
  preferredStations: callsigns,
  avoidedStations: callsigns,
  maxTotalMinutes: z.number().int().min(15).max(1440).nullable(),
  excludeFromSolver: z.boolean(),
});

const putSchema = z.object({ preferences: z.array(preferenceSchema).min(1).max(500) });

async function context(params: Promise<{ eventId: string }>) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (!isValidId(eventId)) {
    return { error: NextResponse.json({ error: "Invalid event id" }, { status: 400 }) };
  }
  const roster = await prisma.eventRoster.findUnique({ where: { eventId }, select: { id: true } });
  return { cid: Number(user.cid), eventId, roster };
}

// GET: strukturierte Wünsche aller Controller dieses Plans
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  if (!(await canViewEventRoster(ctx.cid, ctx.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.roster) return NextResponse.json({ preferences: [] });

  const rows = await prisma.eventRosterPreference.findMany({ where: { rosterId: ctx.roster.id } });
  return NextResponse.json({ preferences: rows.map(toControllerPreference) });
}

// PUT: Wünsche eines oder mehrerer Controller setzen (leer = löschen)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  if (!(await canEditEventRoster(ctx.cid, ctx.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });
  const rosterId = ctx.roster.id;

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Wünsche nur für Personen, die sich für dieses Event angemeldet haben
  // (auch zurückgezogene – ihre Einträge sollen sich noch löschen lassen)
  const cids = [...new Set(parsed.data.preferences.map((p) => p.userCID))];
  const signedUp = await prisma.eventSignup.findMany({
    where: { eventId: ctx.eventId, userCID: { in: cids } },
    select: { userCID: true },
  });
  const known = new Set(signedUp.map((s) => s.userCID));
  const unknown = cids.filter((c) => !known.has(c));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: `Nicht für dieses Event angemeldet: ${unknown.join(", ")}` },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.preferences.map((p) => {
      // Eine Station kann nicht zugleich gewünscht und abgelehnt sein – die
      // Ablehnung ist die stärkere Aussage.
      const avoided = p.avoidedStations;
      const preferred = p.preferredStations.filter((c) => !avoided.includes(c));
      const data = {
        preferredStations: preferred,
        avoidedStations: avoided,
        maxTotalMinutes: p.maxTotalMinutes,
        excludeFromSolver: p.excludeFromSolver,
        updatedByCID: ctx.cid,
      };
      if (isEmptyPreference({ ...data })) {
        return prisma.eventRosterPreference.deleteMany({
          where: { rosterId, userCID: p.userCID },
        });
      }
      return prisma.eventRosterPreference.upsert({
        where: { rosterId_userCID: { rosterId, userCID: p.userCID } },
        create: { rosterId, userCID: p.userCID, ...data },
        update: data,
      });
    })
  );

  const n = parsed.data.preferences.length;
  await logRosterActivity({
    rosterId,
    actorCID: ctx.cid,
    action: "preferences_changed",
    summary:
      n === 1
        ? "Wünsche für die automatische Planung angepasst"
        : `Wünsche von ${n} Controllern für die automatische Planung angepasst`,
    targetCID: n === 1 ? parsed.data.preferences[0].userCID : null,
  });

  // Kein broadcastRosterChange: Wünsche gehören nicht zum Plan, offene Editoren
  // müssten sonst grundlos neu laden
  const rows = await prisma.eventRosterPreference.findMany({ where: { rosterId } });
  return NextResponse.json({ preferences: rows.map(toControllerPreference) });
}
