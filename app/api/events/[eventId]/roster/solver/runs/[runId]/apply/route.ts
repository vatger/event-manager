import { NextRequest, NextResponse } from "next/server";
import { isValidId } from "@/lib/roster/solver/api";
import { getSessionUser } from "@/lib/getSessionUser";
import { canEditEventRoster } from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";
import { applySolverRun } from "@/lib/roster/solver/apply";


// POST: Vorschlag eines Laufs in den Plan übernehmen (siehe applySolverRun)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; runId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cid = Number(user.cid);

  const { eventId: e, runId: r } = await params;
  const eventId = Number(e);
  const runId = Number(r);
  if (!isValidId(eventId) || !isValidId(runId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!(await canEditEventRoster(cid, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await applySolverRun(eventId, runId, cid);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json({
    created: res.created,
    skipped: res.skipped,
    removed: res.removed,
    keptEdited: res.keptEdited,
    snapshotId: res.snapshotId,
  });
}
