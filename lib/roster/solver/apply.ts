import { prisma } from "@/lib/prisma";
import {
  checkAssignment,
  ROSTER_INCLUDE,
  serializeRoster,
} from "@/lib/roster/eventRosterService";
import { getCachedSignupTable } from "@/lib/cache/signupTableCache";
import { logRosterActivity } from "@/lib/roster/rosterActivity";
import { minuteToDate } from "@/lib/roster/rosterTime";
import { resolveSolverConfig, type SolverResult } from "./types";

export interface ApplyOutcome {
  created: number;
  skipped: number;
  removed: number;
  /** Zu ersetzende Schichten, die seit dem Lauf bearbeitet wurden und deshalb bleiben */
  keptEdited: number;
  snapshotId: number | null;
}

class AlreadyApplied extends Error {}
class Superseded extends Error {}

/**
 * Warum sich ein Lauf nicht mehr übernehmen lässt – oder null.
 *
 * Übernommen werden darf nur der jüngste Vorschlag, und nur, solange seit
 * seinem Start kein anderer übernommen wurde: Er wurde gegen den damaligen
 * Plan gerechnet. Sonst mischten sich zwei Pläne, und im Ersetzen-Modus
 * fehlten die zu ersetzenden Schichten längst – gemeldet würde trotzdem Erfolg.
 */
export async function supersededReason(
  db: Pick<typeof prisma, "eventRosterSolverRun" | "eventRosterActivity">,
  run: { id: number; rosterId: number; createdAt: Date }
): Promise<string | null> {
  const newer = await db.eventRosterSolverRun.findFirst({
    where: { rosterId: run.rosterId, id: { gt: run.id }, status: { in: ["done", "applied"] } },
    select: { id: true },
  });
  if (newer) return `Es gibt einen neueren Vorschlag (Lauf #${newer.id}) – nur der jüngste lässt sich übernehmen`;
  const appliedSince = await db.eventRosterSolverRun.findFirst({
    where: {
      rosterId: run.rosterId,
      id: { not: run.id },
      status: "applied",
      appliedAt: { gte: run.createdAt },
    },
    select: { id: true },
  });
  if (appliedSince) {
    return `Seit dem Start dieses Laufs wurde Lauf #${appliedSince.id} übernommen – bitte neu planen`;
  }
  // Wiederherstellen, Zurücksetzen und Stationsänderungen legen Stationen und
  // Schichten neu an: Die IDs des Laufs liefen dann ins Leere – jede Schicht
  // würde ausgelassen, ersetzt würde nichts, und trotzdem hieße es „übernommen“.
  const rebuilt = await db.eventRosterActivity.findFirst({
    where: {
      rosterId: run.rosterId,
      action: { in: ["snapshot_restored", "roster_reset", "stations_changed"] },
      createdAt: { gte: run.createdAt },
    },
    select: { id: true },
  });
  if (rebuilt) {
    return "Seit dem Start dieses Laufs wurden Stationen geändert oder der Plan zurückgesetzt bzw. wiederhergestellt – bitte neu planen";
  }
  return null;
}

export type ApplyResult =
  | ({ ok: true } & ApplyOutcome)
  | { ok: false; status: 404 | 409; error: string };

/**
 * Vorschlag eines Laufs in den Plan übernehmen.
 *
 * Vorher wird der aktuelle Stand als Snapshot gesichert – wer mit dem Ergebnis
 * nicht glücklich ist, kommt mit einem Klick zurück. Seit dem Lauf kann jemand
 * am Plan weitergearbeitet haben; Schichten, die inzwischen kollidieren
 * (Station belegt, Person anderweitig eingeplant, Anmeldung zurückgezogen),
 * werden deshalb ausgelassen und gezählt statt den ganzen Vorgang scheitern zu
 * lassen. Ebenso bleiben zu ersetzende Schichten stehen, die seit dem Lauf
 * bearbeitet wurden.
 */
export async function applySolverRun(
  eventId: number,
  runId: number,
  cid: number
): Promise<ApplyResult> {
  // Der volle Plan wird erst in der Transaktion gelesen – hier genügt die ID
  const [event, roster] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId } }),
    prisma.eventRoster.findUnique({ where: { eventId }, select: { id: true } }),
  ]);
  if (!event || !roster) return { ok: false, status: 404, error: "Roster not found" };

  const run = await prisma.eventRosterSolverRun.findFirst({
    where: { id: runId, rosterId: roster.id },
  });
  if (!run) return { ok: false, status: 404, error: "Run not found" };
  if (run.status !== "done" || !run.result) {
    return {
      ok: false,
      status: 409,
      error:
        run.status === "applied"
          ? "Dieser Vorschlag wurde bereits übernommen"
          : "Für diesen Lauf liegt kein Vorschlag vor",
    };
  }

  const stale = await supersededReason(prisma, run);
  if (stale) return { ok: false, status: 409, error: stale };

  const result = run.result as unknown as SolverResult;
  // Minuten beziehen sich auf den Event-Beginn zur Zeit des Laufs
  const runStart = new Date(result.eventStart);
  // Die Mindestpause ist hart: Was seit dem Lauf neben eine vorgeschlagene
  // Schicht eingetragen wurde, kennt der Rechenkern nicht
  const minBreakMs = resolveSolverConfig(run.config).minBreakMinutes * 60000;

  const signups = await getCachedSignupTable(eventId);
  const activeCids = new Set(signups.filter((s) => !s.deletedAt).map((s) => s.user.cid));

  // Alles in einer Transaktion: Lauf als übernommen markieren, Snapshot vom
  // aktuellen Stand, Schichten tauschen. Bricht etwas ab, bleibt nichts davon
  // zurück – auch kein „übernommen“ ohne Schichten.
  let outcome: Omit<ApplyOutcome, "snapshotId">;
  let snapshotId: number;
  try {
    ({ outcome, snapshotId } = await prisma.$transaction(
      async (tx) => {
        // Gleichzeitiges Übernehmen durch zwei Personen verhindern
        const claimed = await tx.eventRosterSolverRun.updateMany({
          where: { id: run.id, status: "done" },
          data: { status: "applied", appliedAt: new Date(), appliedByCID: cid },
        });
        if (claimed.count === 0) throw new AlreadyApplied();
        // Erneut in der Transaktion: Zwei gleichzeitig übernommene Läufe
        // sehen einander so – der ältere scheitert am neueren
        const staleNow = await supersededReason(tx, run);
        if (staleNow) throw new Superseded(staleNow);

        // Snapshot vom Stand in dieser Transaktion, nicht vom vorab gelesenen
        const current = await tx.eventRoster.findUniqueOrThrow({
          where: { id: roster.id },
          include: ROSTER_INCLUDE,
        });
        // Unabhängig vom (nachträglich und ohne Gewähr geschriebenen)
        // Protokoll: Gibt es eine Station des Laufs nicht mehr, wurden die
        // Stationen neu angelegt oder entfernt – die IDs liefen ins Leere
        const stationIds = new Set(current.stations.map((s) => s.id));
        if (result.assignments.some((a) => !stationIds.has(a.stationId))) {
          throw new Superseded(
            "Seit dem Start dieses Laufs wurden Stationen geändert oder der Plan wiederhergestellt – bitte neu planen"
          );
        }
        const snapshot = await tx.eventRosterSnapshot.create({
          data: {
            rosterId: roster.id,
            name: `Vor automatischer Planung (Lauf #${run.id})`,
            data: JSON.parse(JSON.stringify(serializeRoster(current))),
            createdByCID: cid,
          },
          select: { id: true },
        });

        let removed = 0;
        let keptEdited = 0;
        if (result.replacesExisting && result.removedAssignmentIds.length > 0) {
          // Nur Schichten entfernen, die seit dem Lauf niemand angefasst hat –
          // eine danach bearbeitete Schicht bleibt stehen, neue Schichten, die
          // mit ihr kollidieren, werden unten ausgelassen.
          const stand = new Map(
            result.removedAssignments.map((a) => [a.id, new Date(a.updatedAt).getTime()])
          );
          const candidates = await tx.eventRosterAssignment.findMany({
            where: { rosterId: roster.id, type: "controller", id: { in: result.removedAssignmentIds } },
            select: { id: true, updatedAt: true },
          });
          const unchanged = candidates.filter((a) => {
            const at = stand.get(a.id);
            return at !== undefined && a.updatedAt.getTime() === at;
          });
          keptEdited = candidates.length - unchanged.length;
          if (unchanged.length > 0) {
            const del = await tx.eventRosterAssignment.deleteMany({
              where: { id: { in: unchanged.map((a) => a.id) } },
            });
            removed = del.count;
          }
        }

        // Stand nach dem Entfernen – dagegen wird jede neue Schicht geprüft,
        // mit derselben Prüfung wie beim Eintragen von Hand
        const working = {
          stations: current.stations,
          assignments: await tx.eventRosterAssignment.findMany({ where: { rosterId: roster.id } }),
        };

        const toCreate: {
          rosterId: number;
          stationId: number;
          type: string;
          userCID: number;
          startTime: Date;
          endTime: Date;
        }[] = [];
        let skipped = 0;
        for (const a of result.assignments) {
          const input = {
            stationId: a.stationId,
            type: "controller" as const,
            userCID: a.userCID,
            startTime: minuteToDate(runStart, a.start),
            endTime: minuteToDate(runStart, a.end),
          };
          // Zurückgezogene Anmeldungen lässt die Prüfung bewusst zu (Editor
          // markiert sie) – automatisch wird dort aber niemand eingeplant.
          const tooClose =
            minBreakMs > 0 &&
            working.assignments.some(
              (b) =>
                b.userCID === a.userCID &&
                b.type !== "custom" &&
                b.startTime.getTime() < input.endTime.getTime() + minBreakMs &&
                input.startTime.getTime() < b.endTime.getTime() + minBreakMs
            );
          if (
            !activeCids.has(a.userCID) ||
            tooClose ||
            checkAssignment(event, working, input, signups)
          ) {
            skipped++;
            continue;
          }
          const now = new Date();
          working.assignments.push({
            id: -(toCreate.length + 1),
            rosterId: roster.id,
            label: null,
            color: null,
            createdAt: now,
            updatedAt: now,
            ...input,
          });
          toCreate.push({ rosterId: roster.id, ...input });
        }
        if (toCreate.length > 0) await tx.eventRosterAssignment.createMany({ data: toCreate });
        return {
          outcome: { created: toCreate.length, skipped, removed, keptEdited },
          snapshotId: snapshot.id,
        };
      },
      { timeout: 30_000 }
    ));
  } catch (err) {
    if (err instanceof AlreadyApplied) {
      return { ok: false, status: 409, error: "Dieser Vorschlag wurde bereits übernommen" };
    }
    if (err instanceof Superseded) return { ok: false, status: 409, error: err.message };
    throw err;
  }

  // Ab hier ist der Plan geändert und bleibt es: Nichts danach darf den Lauf
  // zurücksetzen, sonst ließe er sich ein zweites Mal übernehmen.
  await logRosterActivity({
    rosterId: roster.id,
    actorCID: cid,
    action: "solver_applied",
    summary:
      `Vorschlag der automatischen Planung übernommen: ${outcome.created} ${
        outcome.created === 1 ? "Schicht" : "Schichten"
      } eingeplant` +
      (outcome.removed > 0 ? `, ${outcome.removed} bisherige ersetzt` : "") +
      (outcome.keptEdited > 0
        ? `, ${outcome.keptEdited} seit dem Lauf bearbeitete behalten`
        : "") +
      (outcome.skipped > 0 ? `, ${outcome.skipped} wegen Konflikten ausgelassen` : ""),
    details: { runId: run.id, snapshotId, ...outcome },
  });

  return { ok: true, ...outcome, snapshotId };
}
