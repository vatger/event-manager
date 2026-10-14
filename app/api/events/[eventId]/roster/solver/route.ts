import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster, canViewEventRoster } from "@/lib/roster/eventRosterService";
import { resolveSolverConfig } from "@/lib/roster/solver/types";
import { isValidId, serializeRuns, solverConfigSchema } from "@/lib/roster/solver/api";
import {
  KEPT_SOLVER_RUNS,
  recoverInterruptedRuns,
  SolverBusyError,
  startSolverRun,
} from "@/lib/roster/solver/solverRunner";


async function context(params: Promise<{ eventId: string }>) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (!isValidId(eventId)) {
    return { error: NextResponse.json({ error: "Invalid event id" }, { status: 400 }) };
  }
  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: { id: true, solverConfig: true },
  });
  return { user, cid: Number(user.cid), eventId, roster };
}

// GET: Einstellungen und die letzten Läufe (ohne Ergebnis)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  if (!(await canViewEventRoster(ctx.cid, ctx.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  // Vom Neustart unterbrochene Läufe nicht als „läuft“ ausliefern
  await recoverInterruptedRuns();
  const runs = await prisma.eventRosterSolverRun.findMany({
    where: { rosterId: ctx.roster.id },
    orderBy: { createdAt: "desc" },
    take: KEPT_SOLVER_RUNS,
    // Das Ergebnis kann groß sein und wird hier nicht ausgeliefert
    omit: { result: true },
  });
  return NextResponse.json({
    config: resolveSolverConfig(ctx.roster.solverConfig),
    runs: await serializeRuns(runs),
  });
}

// PUT: Einstellungen speichern
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

  const parsed = solverConfigSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }
  await prisma.eventRoster.update({
    where: { id: ctx.roster.id },
    data: { solverConfig: JSON.parse(JSON.stringify(parsed.data)) },
  });
  return NextResponse.json({ config: parsed.data });
}

// POST: Lauf mit den gespeicherten Einstellungen starten
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  if (!(await canEditEventRoster(ctx.cid, ctx.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ctx.roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  try {
    const runId = await startSolverRun(
      ctx.roster.id,
      ctx.eventId,
      resolveSolverConfig(ctx.roster.solverConfig),
      ctx.cid
    );
    const run = await prisma.eventRosterSolverRun.findUniqueOrThrow({
      where: { id: runId },
      omit: { result: true },
    });
    const [serialized] = await serializeRuns([run]);
    return NextResponse.json({ run: serialized }, { status: 202 });
  } catch (err) {
    if (err instanceof SolverBusyError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
