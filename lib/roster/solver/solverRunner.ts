/**
 * Hintergrundläufe der automatischen Planung.
 *
 * Ein Lauf wird als Zeile (EventRosterSolverRun) angelegt und sofort
 * beantwortet; gerechnet wird danach im Hintergrund. Der Editor fragt den
 * Stand ab, bis das Ergebnis da ist.
 *
 * Gerechnet wird in einem Worker-Thread, damit der Server währenddessen
 * ungestört Anfragen beantwortet. Lässt sich kein Worker starten, rechnet der
 * Hauptprozess in Häppchen von wenigen Millisekunden und gibt dazwischen
 * immer wieder ab – langsamer, aber ebenfalls ohne andere zu blockieren.
 *
 * Gleichzeitig laufen höchstens ROSTER_SOLVER_CONCURRENCY Läufe (Standard 1),
 * weitere warten. Der Zustand liegt auf globalThis, damit er HMR übersteht;
 * vorausgesetzt ist – wie beim Realtime-Bus – eine Server-Instanz.
 */

import { Worker } from "node:worker_threads";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RosterSolver, type CoreSession } from "./core";
import { WORKER_SOURCE } from "./workerSource";
import { buildSolverResult, prepareSolve, SolverPreparationError } from "./prepare";
import type { SolverConfig, SolverInput } from "./types";

interface ActiveRun {
  cancel: () => void;
}

interface RunnerState {
  active: Map<number, ActiveRun>;
  queue: { runId: number; eventId: number }[];
  recovery: Promise<void> | null;
  /** Pläne, für die gerade ein Lauf angelegt wird (gegen Doppelklick/zwei Editoren) */
  starting: Set<number>;
}

const globalForRunner = globalThis as unknown as { __rosterSolverRunner?: RunnerState };

function state(): RunnerState {
  if (!globalForRunner.__rosterSolverRunner) {
    globalForRunner.__rosterSolverRunner = {
      active: new Map(),
      queue: [],
      recovery: null,
      starting: new Set(),
    };
  }
  return globalForRunner.__rosterSolverRunner;
}

function concurrency(): number {
  const n = Number(process.env.ROSTER_SOLVER_CONCURRENCY);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * Läufe, die ein früherer Prozess begonnen hat, kommen nie mehr zu Ende –
 * einmal je Prozess als gescheitert markieren, damit niemand ewig wartet.
 * Wird vor jedem Lesen und Starten abgewartet, damit der Editor solche Läufe
 * nicht endlos abfragt.
 */
export function recoverInterruptedRuns(): Promise<void> {
  const s = state();
  if (!s.recovery) {
    s.recovery = prisma.eventRosterSolverRun
      .updateMany({
        where: { status: { in: ["queued", "running"] } },
        data: {
          status: "failed",
          error: "Der Server wurde neu gestartet, bevor der Lauf fertig war.",
          finishedAt: new Date(),
        },
      })
      .then(() => undefined)
      .catch((err) => {
        // Beim nächsten Aufruf erneut versuchen
        s.recovery = null;
        throw err;
      });
  }
  return s.recovery;
}

export class SolverBusyError extends Error {}

/** So viele Läufe je Plan bleiben erhalten (so viele zeigt auch der Editor) */
export const KEPT_SOLVER_RUNS = 10;

/**
 * Ältere Läufe eines Plans aufräumen – sonst wächst die Tabelle samt
 * Ergebnissen mit jedem Lauf. Laufende und wartende bleiben unangetastet.
 * Übernommene Läufe bleiben als kleine Zeile ohne Ergebnis stehen: An ihnen
 * erkennt applySolverRun, dass ein älterer Vorschlag überholt ist.
 */
async function pruneOldRuns(rosterId: number): Promise<void> {
  const keep = await prisma.eventRosterSolverRun.findMany({
    where: { rosterId },
    orderBy: { createdAt: "desc" },
    take: KEPT_SOLVER_RUNS,
    select: { id: true },
  });
  if (keep.length < KEPT_SOLVER_RUNS) return;
  const old = { rosterId, id: { notIn: keep.map((r) => r.id) } };
  await prisma.$transaction([
    prisma.eventRosterSolverRun.deleteMany({
      where: { ...old, status: { in: ["done", "failed", "cancelled"] } },
    }),
    prisma.eventRosterSolverRun.updateMany({
      where: { ...old, status: "applied" },
      data: { result: Prisma.DbNull },
    }),
  ]);
}

/** Neuen Lauf anlegen und einreihen */
export async function startSolverRun(
  rosterId: number,
  eventId: number,
  config: SolverConfig,
  actorCID: number
): Promise<number> {
  await recoverInterruptedRuns();

  // Zwischen Prüfung und Anlegen darf kein zweiter Start desselben Plans
  // durchrutschen. Die Sperre im Prozess genügt, weil ohnehin nur eine
  // Server-Instanz rechnet (siehe oben).
  const s = state();
  if (s.starting.has(rosterId)) {
    throw new SolverBusyError("Für diesen Plan läuft bereits eine Planung");
  }
  s.starting.add(rosterId);
  try {
    const running = await prisma.eventRosterSolverRun.findFirst({
      where: { rosterId, status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    if (running) throw new SolverBusyError("Für diesen Plan läuft bereits eine Planung");

    const run = await prisma.eventRosterSolverRun.create({
      data: {
        rosterId,
        status: "queued",
        config: JSON.parse(JSON.stringify(config)),
        createdByCID: actorCID,
      },
      select: { id: true },
    });

    s.queue.push({ runId: run.id, eventId });
    pump();
    // Aufräumen darf den Start nicht scheitern lassen
    await pruneOldRuns(rosterId).catch((err) =>
      console.error("[SOLVER] Alte Läufe konnten nicht gelöscht werden:", err)
    );
    return run.id;
  } finally {
    s.starting.delete(rosterId);
  }
}

/** Laufenden oder wartenden Lauf abbrechen */
export async function cancelSolverRun(runId: number): Promise<boolean> {
  const s = state();
  const queued = s.queue.findIndex((q) => q.runId === runId);
  if (queued >= 0) s.queue.splice(queued, 1);
  s.active.get(runId)?.cancel();

  const res = await prisma.eventRosterSolverRun.updateMany({
    where: { id: runId, status: { in: ["queued", "running"] } },
    data: { status: "cancelled", finishedAt: new Date() },
  });
  return res.count > 0;
}

function pump(): void {
  const s = state();
  while (s.active.size < concurrency() && s.queue.length > 0) {
    const { runId, eventId } = s.queue.shift()!;
    let cancelled = false;
    const handle: ActiveRun = { cancel: () => (cancelled = true) };
    s.active.set(runId, handle);
    void execute(runId, eventId, handle, () => cancelled).finally(() => {
      s.active.delete(runId);
      pump();
    });
  }
}

async function execute(
  runId: number,
  eventId: number,
  handle: ActiveRun,
  isCancelled: () => boolean
): Promise<void> {
  const startedAt = Date.now();
  try {
    const run = await prisma.eventRosterSolverRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== "queued") return;
    // Nur einen noch wartenden Lauf starten: Ein Abbruch, der zwischen Lesen
    // und Schreiben eintrifft, darf nicht wieder mit „running“ überschrieben
    // werden – sonst bliebe der Plan bis zum Neustart blockiert.
    const claimed = await prisma.eventRosterSolverRun.updateMany({
      where: { id: runId, status: "queued" },
      data: { status: "running", startedAt: new Date(), progress: 0 },
    });
    if (claimed.count === 0) return;

    const prepared = await prepareSolve(eventId, run.config as unknown as SolverConfig);
    if (isCancelled()) return;

    let lastWrite = 0;
    const onProgress = (progress: number) => {
      const now = Date.now();
      if (now - lastWrite < 1000) return;
      lastWrite = now;
      void prisma.eventRosterSolverRun
        .updateMany({
          where: { id: runId, status: "running" },
          data: { progress: Math.round(progress * 100) },
        })
        .catch(() => undefined);
    };

    const core = await runCore(prepared.input, onProgress, handle, isCancelled);
    if (!core || isCancelled()) return;

    const result = buildSolverResult(prepared, core.sessions, core.iterations, Date.now() - startedAt);
    // Sichtbar machen statt nur im Log: Im Hauptprozess rechnet es langsamer
    if (core.workerFailed) {
      result.notes.push(
        "Der Worker-Thread ließ sich nicht starten – berechnet im Hauptprozess (Details im Server-Log)."
      );
    }
    await prisma.eventRosterSolverRun.updateMany({
      where: { id: runId, status: "running" },
      data: {
        status: "done",
        progress: 100,
        result: JSON.parse(JSON.stringify(result)),
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`[SOLVER] Lauf ${runId} fehlgeschlagen:`, err);
    const message =
      err instanceof SolverPreparationError || err instanceof WorkerHangError
        ? err.message
        : "Die Planung ist unerwartet abgebrochen. Details stehen im Server-Log.";
    await prisma.eventRosterSolverRun
      .updateMany({
        where: { id: runId, status: { in: ["queued", "running"] } },
        data: { status: "failed", error: message, finishedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

/** Der Worker lief, kam aber nicht zum Ende */
class WorkerHangError extends Error {}

type CoreOutput = {
  sessions: CoreSession[];
  iterations: number;
  /** Der Worker scheiterte, gerechnet wurde im Hauptprozess */
  workerFailed?: boolean;
};

/** Rechenkern ausführen – bevorzugt im Worker, sonst in Häppchen */
async function runCore(
  input: SolverInput,
  onProgress: (p: number) => void,
  handle: ActiveRun,
  isCancelled: () => boolean
): Promise<CoreOutput | null> {
  if (process.env.ROSTER_SOLVER_WORKER !== "false") {
    try {
      return await runInWorker(input, onProgress, handle);
    } catch (err) {
      if (isCancelled()) return null;
      // Gehangen statt gar nicht gestartet: nicht noch einmal rechnen
      if (err instanceof WorkerHangError) throw err;
      console.warn("[SOLVER] Worker nicht verfügbar, rechne im Hauptprozess:", err);
      const out = await runSliced(input, onProgress, isCancelled);
      return out && { ...out, workerFailed: true };
    }
  }
  return runSliced(input, onProgress, isCancelled);
}

function runInWorker(
  input: SolverInput,
  onProgress: (p: number) => void,
  handle: ActiveRun
): Promise<CoreOutput | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { input } });
    let settled = false;
    // Sicherheitsnetz: Der Kern hört nach timeLimitMs von selbst auf. Hängt
    // der Worker darüber hinaus, wird er beendet und der Lauf scheitert –
    // ohne die volle Rechenzeit im Hauptprozess noch einmal zu verbrauchen
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      reject(new WorkerHangError("Die Planung hat das Zeitlimit deutlich überschritten"));
    }, input.timeLimitMs + 30_000);

    const previousCancel = handle.cancel;
    handle.cancel = () => {
      previousCancel();
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      void worker.terminate();
      resolve(null);
    };

    worker.on("message", (msg: { type: string; progress?: number; result?: CoreOutput }) => {
      if (msg.type === "progress" && typeof msg.progress === "number") onProgress(msg.progress);
      if (msg.type === "done" && msg.result && !settled) {
        settled = true;
        clearTimeout(watchdog);
        resolve({ sessions: msg.result.sessions, iterations: msg.result.iterations });
        void worker.terminate();
      }
    });
    worker.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      reject(err);
    });
    worker.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      reject(new Error(`Worker beendet mit Code ${code}`));
    });
  });
}

async function runSliced(
  input: SolverInput,
  onProgress: (p: number) => void,
  isCancelled: () => boolean
): Promise<CoreOutput | null> {
  const solver = new RosterSolver(input);
  for (;;) {
    if (isCancelled()) return null;
    const p = solver.step(15);
    onProgress(p.progress);
    if (p.done) break;
    // Event-Loop freigeben, damit andere Anfragen dazwischen drankommen
    await new Promise<void>((r) => setImmediate(r));
  }
  const res = solver.result();
  return { sessions: res.sessions, iterations: res.iterations };
}
