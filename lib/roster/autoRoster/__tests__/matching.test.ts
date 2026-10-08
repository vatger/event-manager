import { describe, expect, it } from "vitest";
import { minCostAssignment, priorityMatching } from "../matching";

describe("priorityMatching", () => {
  it("bevorzugt vordere Zeilen, ohne die Paarung zu verkleinern", () => {
    // Zeile 0 und 1 wollen beide Spalte 0; Zeile 1 kann auch Spalte 1
    expect(Array.from(priorityMatching([[0], [0, 1]], 2))).toEqual([0, 1]);
    // Nur eine Spalte: die vordere Zeile gewinnt
    expect(Array.from(priorityMatching([[0], [0]], 1))).toEqual([0, -1]);
  });

  it("verschiebt bestehende Paarungen über augmentierende Pfade", () => {
    expect(Array.from(priorityMatching([[0, 1], [0]], 2))).toEqual([1, 0]);
  });
});

describe("minCostAssignment", () => {
  it("findet die günstigste Zuordnung", () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
    ];
    // 0→1 (1) + 1→0 (2) = 3 ist günstiger als 0→0 (4) + 1→1 (0) = 4
    expect(Array.from(minCostAssignment(cost, 3))).toEqual([1, 0]);
  });
});
