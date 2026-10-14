import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SOLVER_CONFIG, resolveSolverConfig } from "../types";
import { solverConfigSchema } from "../api";

describe("Einstellungen", () => {
  it("nimmt ohne gespeicherte Werte die Standardwerte", () => {
    for (const stored of [null, undefined, "x", 3, [], {}]) {
      assert.deepEqual(resolveSolverConfig(stored), DEFAULT_SOLVER_CONFIG);
    }
  });

  it("ergänzt gespeicherte Werte um fehlende Standardwerte", () => {
    const c = resolveSolverConfig({ minSessionMinutes: 45, stationPriorities: { EDDF_TWR: 1 } });
    assert.equal(c.minSessionMinutes, 45);
    assert.equal(c.maxSessionMinutes, DEFAULT_SOLVER_CONFIG.maxSessionMinutes);
    assert.deepEqual(c.stationPriorities, { EDDF_TWR: 1 });
  });

  it("teilt die Prioritäten nicht mit den Standardwerten", () => {
    const c = resolveSolverConfig({});
    c.stationPriorities.EDDF_TWR = 1;
    assert.deepEqual(DEFAULT_SOLVER_CONFIG.stationPriorities, {});
  });

  it("akzeptiert die Standardwerte", () => {
    assert.equal(solverConfigSchema.safeParse(DEFAULT_SOLVER_CONFIG).success, true);
  });

  it("lehnt widersprüchliche Werte ab", () => {
    const bad = [
      { minSessionMinutes: 120, maxSessionMinutes: 60, preferredSessionMinutes: 90 },
      { preferredSessionMinutes: 150 },
      { minBreakMinutes: 60, maxBreakMinutes: 30 },
      { maxTotalMinutes: 30 },
      { timeLimitSeconds: 1000 },
      { stationPriorities: { EDDF_TWR: 7 } },
      { preferenceWeight: 11 },
    ];
    for (const patch of bad) {
      const r = solverConfigSchema.safeParse({ ...DEFAULT_SOLVER_CONFIG, ...patch });
      assert.equal(r.success, false, JSON.stringify(patch));
    }
  });
});
