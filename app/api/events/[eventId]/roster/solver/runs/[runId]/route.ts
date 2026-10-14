import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster, canViewEventRoster } from "@/lib/roster/eventRosterService";
import { isValidId, serializeRuns } from "@/lib/roster/solver/api";
import { cancelSolverRun, recoverInterruptedRuns } from "@/lib/roster/solver/solverRunner";
import { supersededReason } from "@/lib/roster/solver/apply";


async function loadRun(params: Promise<{ eventId: string; runId: string }>) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { eventId: e, runId: r } = await params;
  const eventId = Number(e);
  const runId = Number(r);
  if (!isValidId(eventId) || !isValidId(runId)) {
    return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  }
  // Vom Neustart unterbrochene Läufe nicht als „läuft“ ausliefern
  await recoverInterruptedRuns();
  const run = await prisma.eventRosterSolverRun.findFirst({
    where: { id: runId, roster: { eventId } },
  });
  if (!run) return { error: NextResponse.json({ error: "Run not found" }, { status: 404 }) };
  return { cid: Number(user.cid), eventId, run };
}

// GET: Stand eines Laufs inkl. Ergebnis
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; runId: string }> }
) {
  const ctx = await loadRun(params);
  if ("error" in ctx) return ctx.error;
  if (!(await canViewEventRoster(ctx.cid, ctx.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [run] = await serializeRuns([ctx.run], true);
  // Dieselbe Prüfung wie beim Übernehmen – der Editor blendet den Knopf dann aus
  if (ctx.run.status === "done") run.staleReason = await supersededReason(prisma, ctx.run);
  return NextResponse.json({ run });
}

// DELETE: Laufenden oder wartenden Lauf abbrechen
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; runId: string }> }
) {
  const ctx = await loadRun(params);
  if ("error" in ctx) return ctx.error;
  if (!(await canEditEventRoster(ctx.cid, ctx.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cancelled = await cancelSolverRun(ctx.run.id);
  return NextResponse.json({ cancelled });
}
