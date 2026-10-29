import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SOLVER_CONFIG, resolveSolverConfig } from "../types";
import { solverConfigSchema } from "../api";
import { isC1OnS1Station } from "../prepare";

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

describe("Regel: keine C1 auf S1-Stationen", () => {
  it("ist standardmäßig an, auch für ältere gespeicherte Einstellungen", () => {
    assert.equal(resolveSolverConfig(null).keepC1OffS1Stations, true);
    assert.equal(resolveSolverConfig({ minSessionMinutes: 60 }).keepC1OffS1Stations, true);
    assert.equal(resolveSolverConfig({ keepC1OffS1Stations: false }).keepC1OffS1Stations, false);
  });

  it("trifft nur C1 und höher auf Stationen, die S1 besetzen dürfen", () => {
    const s1Tower = { group: "TWR" as const, s1Twr: true, gcapStatus: null };
    assert.equal(isC1OnS1Station(s1Tower, "C1"), true);
    assert.equal(isC1OnS1Station(s1Tower, "I1"), true);
    assert.equal(isC1OnS1Station(s1Tower, "S3"), false);
    // Tower ohne S1-Freigabe (EDDM_N_TWR)
    assert.equal(isC1OnS1Station({ group: "TWR", s1Twr: false, gcapStatus: "1" }, "C1"), false);
    // Ground außerhalb von Tier 1 (EDJA_GND) – ja; Tier-1-Ground (EDDM_N_GND) – nein
    assert.equal(isC1OnS1Station({ group: "GND", s1Twr: false, gcapStatus: null }, "C1"), true);
    assert.equal(isC1OnS1Station({ group: "DEL", s1Twr: false, gcapStatus: null }, "C3"), true);
    assert.equal(isC1OnS1Station({ group: "GND", s1Twr: false, gcapStatus: "1" }, "C1"), false);
    assert.equal(isC1OnS1Station({ group: "APP", s1Twr: false, gcapStatus: null }, "C1"), false);
  });
});

describe("Ältere Clients", () => {
  it("ergänzt den fehlenden Schalter beim Prüfen", () => {
    const { keepC1OffS1Stations: _omit, ...old } = DEFAULT_SOLVER_CONFIG;
    void _omit;
    const parsed = solverConfigSchema.safeParse(old);
    assert.ok(parsed.success);
    assert.equal(parsed.data.keepC1OffS1Stations, true);
  });
});
