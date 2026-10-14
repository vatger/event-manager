import { z } from "zod";
import type { EventRosterSolverRun } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveSolverConfig,
  SOLVER_MINUTES_MAX,
  SOLVER_TIME_LIMIT_MAX,
  type ApiSolverRun,
  type SolverResult,
  type SolverRunStatus,
} from "./types";

/** Gültige ID aus der URL? Sonst landen etwa „Infinity“ oder „1e21“ als 500 bei Prisma */
export function isValidId(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0;
}

/** Eingestellte Werte prüfen – Minuten, Gewichte und Prioritäten in sinnvollen Grenzen */
export const solverConfigSchema = z
  .object({
    minSessionMinutes: z.number().int().min(15).max(SOLVER_MINUTES_MAX.minSessionMinutes),
    maxSessionMinutes: z.number().int().min(15).max(SOLVER_MINUTES_MAX.maxSessionMinutes),
    preferredSessionMinutes: z.number().int().min(15).max(SOLVER_MINUTES_MAX.preferredSessionMinutes),
    minBreakMinutes: z.number().int().min(0).max(SOLVER_MINUTES_MAX.minBreakMinutes),
    maxBreakMinutes: z.number().int().min(0).max(SOLVER_MINUTES_MAX.maxBreakMinutes).nullable(),
    maxTotalMinutes: z.number().int().min(15).max(SOLVER_MINUTES_MAX.maxTotalMinutes).nullable(),
    stationPriorities: z.record(
      z.string().min(3).max(20),
      z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
      ])
    ),
    keepExisting: z.boolean(),
    onlyPreferredStations: z.boolean(),
    preferenceWeight: z.number().min(0).max(10),
    fairnessWeight: z.number().min(0).max(10),
    timeLimitSeconds: z.number().int().min(5).max(SOLVER_TIME_LIMIT_MAX),
  })
  .refine((c) => c.minSessionMinutes <= c.maxSessionMinutes, {
    message: "Die kürzeste Schicht darf nicht länger als die längste sein",
    path: ["maxSessionMinutes"],
  })
  .refine(
    (c) =>
      c.preferredSessionMinutes >= c.minSessionMinutes &&
      c.preferredSessionMinutes <= c.maxSessionMinutes,
    {
      message: "Die angestrebte Schichtlänge muss zwischen kürzester und längster liegen",
      path: ["preferredSessionMinutes"],
    }
  )
  .refine((c) => c.maxBreakMinutes === null || c.maxBreakMinutes >= c.minBreakMinutes, {
    message: "Die längste Pause darf nicht kürzer als die kürzeste sein",
    path: ["maxBreakMinutes"],
  })
  .refine((c) => c.maxTotalMinutes === null || c.maxTotalMinutes >= c.minSessionMinutes, {
    message: "Die Gesamtzeit je Person muss mindestens eine Schicht erlauben",
    path: ["maxTotalMinutes"],
  });

/** Lauf ohne das (große) Ergebnis – für Listen mit `omit: { result: true }` geladen */
type RunRow = Omit<EventRosterSolverRun, "result"> & Partial<Pick<EventRosterSolverRun, "result">>;

/** Lauf für den Editor aufbereiten (ohne Ergebnis, wenn `withResult` fehlt) */
export async function serializeRuns(runs: RunRow[], withResult = false): Promise<ApiSolverRun[]> {
  const cids = [
    ...new Set(runs.map((r) => r.createdByCID).filter((c): c is number => c !== null)),
  ];
  const users = cids.length
    ? await prisma.user.findMany({ where: { cid: { in: cids } }, select: { cid: true, name: true } })
    : [];
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return runs.map((r) => ({
    id: r.id,
    status: r.status as SolverRunStatus,
    progress: r.progress,
    config: resolveSolverConfig(r.config),
    result: withResult ? ((r.result as unknown as SolverResult | null | undefined) ?? null) : null,
    error: r.error,
    createdByCID: r.createdByCID,
    createdByName: r.createdByCID ? nameByCid.get(r.createdByCID) ?? null : null,
    createdAt: r.createdAt.toISOString(),
    startedAt: r.startedAt?.toISOString() ?? null,
    finishedAt: r.finishedAt?.toISOString() ?? null,
    appliedAt: r.appliedAt?.toISOString() ?? null,
  }));
}
