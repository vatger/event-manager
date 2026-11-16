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

  it("zeigt je Besetzungsgruppe, wo es eng wird", () => {
    const input = planningInput(
      [station(1, "EDDM_APP"), station(2, "EDDM_TWR"), station(3, "EDDM_GND")],
      [
        signup(1, "App", AP, { levels: ["GND", "TWR", "APP"] }),
        signup(2, "App2", AP, { levels: ["GND", "TWR", "APP"] }),
        signup(3, "Twr", AP, { levels: ["GND", "TWR"] }),
        signup(4, "Twr2", AP, { levels: ["GND", "TWR"] }),
        signup(5, "Gnd", AP, { levels: ["GND"] }),
        signup(6, "Gnd2", AP, { levels: ["GND"] }),
        signup(7, "Gnd3", AP, { levels: ["GND"] }),
      ],
      { totalMinutes: 120 }
    );
    const report = analyzeFeasibility(input);
    const byLabel = Object.fromEntries(report.groups.map((g) => [g.label, g]));
    expect(report.groups.map((g) => g.label)).toEqual(["APP", "TWR", "GND"]);
    // Für APP springt nach der Paarung niemand mehr ein: zwei Geeignete, beide
    // werden auf APP bzw. TWR gebraucht
    expect(byLabel.APP.minReserve).toBe(0);
    expect(byLabel.APP.status).toBe("tight");
    // GND hat mit drei reinen Ground-Lotsen Reserve
    expect(byLabel.GND.status).toBe("ok");
    expect(byLabel.GND.minReserve).toBeGreaterThan(0);
  });

  it("markiert eine Gruppe mit Lücke als fehlend und trennt Airports", () => {
    const AP2 = ["EDDM", "EDDN"];
    const input = planningInput(
      [station(1, "EDDM_TWR"), station(2, "EDDN_TWR")],
      [signup(1, "A", AP2, { levels: ["GND", "TWR"] })],
      { totalMinutes: 120, eventAirports: AP2 }
    );
    const report = analyzeFeasibility(input);
    expect(report.groups.map((g) => [g.label, g.status])).toEqual([
      ["EDDM TWR", "tight"],
      ["EDDN TWR", "short"],
    ]);
    expect(report.groups[1].gapMinutes).toBe(120);
  });
});
