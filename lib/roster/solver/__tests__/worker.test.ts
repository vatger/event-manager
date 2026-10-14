import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { WORKER_SOURCE } from "../workerSource";
import type { CoreSession } from "../core";
import { hardViolations, randomInput } from "./helpers";

/**
 * Der Worker wird aus dem Quelltext von createRosterSolverClass gestartet.
 * Greift der Rechenkern auf etwas außerhalb dieser Funktion zu (Import,
 * Modulvariable), scheitert genau dieser Test.
 */
describe("Worker", () => {
  it("rechnet aus dem Quelltext im eigenen Thread", async () => {
    const inp = randomInput(21, { slotMinutes: 15, hours: 4, stations: 10, controllers: 20 });
    inp.timeLimitMs = 500;

    const progress: number[] = [];
    const result = await new Promise<{ sessions: CoreSession[] }>((resolve, reject) => {
      const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { input: inp } });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error("Worker hat nicht geantwortet"));
      }, 10_000);
      worker.on("message", (msg: { type: string; progress?: number; result?: { sessions: CoreSession[] } }) => {
        if (msg.type === "progress" && typeof msg.progress === "number") progress.push(msg.progress);
        if (msg.type === "done" && msg.result) {
          clearTimeout(timer);
          void worker.terminate();
          resolve(msg.result);
        }
      });
      worker.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    assert.ok(progress.length > 0, "kein Fortschritt gemeldet");
    assert.equal(progress[progress.length - 1], 1);
    assert.ok(result.sessions.length > 0);
    assert.deepEqual(hardViolations(inp, result.sessions), []);
  });

  it("blockiert den Hauptthread nicht", async () => {
    const inp = randomInput(22, { slotMinutes: 15, hours: 6, stations: 20, controllers: 50 });
    inp.timeLimitMs = 1500;
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { input: inp } });
    const done = new Promise<void>((resolve, reject) => {
      worker.on("message", (msg: { type: string }) => msg.type === "done" && resolve());
      worker.on("error", reject);
    });

    // Während der Worker rechnet, muss die Event-Loop weiter regelmäßig drankommen
    let maxLag = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      maxLag = Math.max(maxLag, now - last - 10);
      last = now;
    }, 10);
    try {
      await done;
    } finally {
      clearInterval(timer);
      await worker.terminate();
    }
    assert.ok(maxLag < 200, `Event-Loop hing ${maxLag} ms`);
  });
});
