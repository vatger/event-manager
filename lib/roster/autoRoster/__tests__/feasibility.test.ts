import { describe, expect, it } from "vitest";
import { analyzeFeasibility, maxWorkInWindow } from "../feasibility";
import { planningInput, signup, station } from "./fixtures";

const AP = ["EDDM"];

describe("maxWorkInWindow", () => {
  it("rechnet die Pausenregel ein", () => {
    expect(maxWorkInWindow(120, 120, 30)).toBe(120);
    expect(maxWorkInWindow(150, 120, 30)).toBe(120);
    expect(maxWorkInWindow(300, 120, 30)).toBe(240);
    expect(maxWorkInWindow(330, 120, 30)).toBe(270);
  });
});

describe("analyzeFeasibility", () => {
  it("meldet ok, wenn genug geeignete Lotsen da sind", () => {
    const input = planningInput(
      [station(1, "EDDM_TWR")],
      [
        signup(1, "A", AP, { levels: ["GND", "TWR"] }),
        signup(2, "B", AP, { levels: ["GND", "TWR"] }),
      ],
      { totalMinutes: 240 }
    );
    const report = analyzeFeasibility(input);
    expect(report.verdict).toBe("ok");
    expect(report.gaps).toEqual([]);
    expect(report.coverableMinutes).toBe(240);
  });

  it("erkennt den Engpass, der erst durch die Pausen entsteht", () => {
    const input = planningInput(
      [station(1, "EDMM_CTR")],
      [
        signup(1, "Center", AP, { levels: ["GND", "TWR", "APP", "CTR"] }),
        signup(2, "Ground", AP, { levels: ["GND"] }),
      ],
      { totalMinutes: 300 }
    );
    const report = analyzeFeasibility(input);
    expect(report.verdict).toBe("insufficient");
    // In jedem einzelnen Slot wäre jemand da …
    expect(report.gaps).toEqual([]);
    // … über den Abend fehlen aber die Pausen
    expect(report.shortfalls).toEqual([
      { levels: ["CTR"], demandMinutes: 300, supplyMinutes: 240, missingMinutes: 60 },
    ]);
    expect(report.unusableCids).toEqual([2]);
  });

  it('unterscheidet „niemand verfügbar" von „woanders gebraucht"', () => {
    const input = planningInput(
      [station(1, "EDDM_APP"), station(2, "EDDM_TWR")],
      [
        // Kann APP und TWR, ist aber 17:00–18:00 weg
        signup(1, "Allround", AP, {
          levels: ["GND", "TWR", "APP"],
          unavailable: [["17:00", "18:00"]],
        }),
      ],
      { totalMinutes: 180 }
    );
    const report = analyzeFeasibility(input);
    expect(report.verdict).toBe("insufficient");
    expect(report.gaps).toEqual([
      { stationId: 1, callsign: "EDDM_APP", start: 60, end: 120, reason: "no_candidate", candidates: 0 },
      { stationId: 2, callsign: "EDDM_TWR", start: 0, end: 60, reason: "contention", candidates: 1 },
      { stationId: 2, callsign: "EDDM_TWR", start: 60, end: 120, reason: "no_candidate", candidates: 0 },
      { stationId: 2, callsign: "EDDM_TWR", start: 120, end: 180, reason: "contention", candidates: 1 },
    ]);
  });

  it("zählt feste Blöcke als besetzt", () => {
    const input = planningInput(
      [station(1, "EDDM_TWR")],
      [signup(1, "A", AP, { levels: ["TWR"] })],
      { totalMinutes: 240, fixed: [{ stationId: 1, userCID: null, start: 0, end: 120 }] }
    );
    const report = analyzeFeasibility(input);
    expect(report.demandMinutes).toBe(120);
    expect(report.verdict).not.toBe("insufficient");
  });
});
