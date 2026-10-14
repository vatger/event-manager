import { createRosterSolverClass } from "./core";

/**
 * Quelltext des Workers.
 *
 * Eine eigene Worker-Datei baut der Bundler (Turbopack) nicht mit – er legt
 * sie nur als Asset ab. Der Rechenkern steckt deshalb vollständig in
 * createRosterSolverClass und wird hier als Quelltext übergeben. Scheitert
 * der Worker trotzdem (etwa an einer Hilfsfunktion des Bundlers), rechnet
 * runCore (solverRunner.ts) im Hauptprozess in Häppchen weiter.
 */
export const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
// Hilfsfunktion, die manche Transpiler (esbuild/tsx) in Funktionen einsetzen
var __name = (target) => target;
const RosterSolver = (${createRosterSolverClass.toString()})();
const solver = new RosterSolver(workerData.input);
for (;;) {
  const p = solver.step(500);
  parentPort.postMessage({ type: "progress", progress: p.progress, iterations: p.iterations });
  if (p.done) break;
}
parentPort.postMessage({ type: "done", result: solver.result() });
`;
