import { describe, expect, it } from "vitest";
import {
  availabilityFromBlocked,
  blockedFromAvailability,
  buildAvailabilityGrid,
  shortAvailableRuns,
} from "../availabilitySlots";

describe("Anmelde-Zeitraster", () => {
  it("rastert Beginn ab und Ende auf", () => {
    const grid = buildAvailabilityGrid("2026-11-05T18:15:00Z", "2026-11-05T20:40:00Z", 30);
    expect(grid.slots.map((s) => s.label)).toEqual(["18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]);
    expect(grid.endLabel).toBe("21:00");
  });

  it("liest und schreibt dasselbe Format wie bisher", () => {
    const grid = buildAvailabilityGrid("2026-11-05T18:00:00Z", "2026-11-05T21:00:00Z", 30);
    const stored = { unavailable: [{ start: "19:00", end: "20:00" }] };
    const blocked = blockedFromAvailability(grid, stored);
    expect(blocked).toEqual([false, false, true, true, false, false]);
    expect(availabilityFromBlocked(grid, blocked)).toEqual({
      available: [
        { start: "18:00", end: "19:00" },
        { start: "20:00", end: "21:00" },
      ],
      unavailable: [{ start: "19:00", end: "20:00" }],
    });
  });

  it("kommt über Mitternacht und mit dem Event-Ende als Bereichsende zurecht", () => {
    const grid = buildAvailabilityGrid("2026-11-05T22:00:00Z", "2026-11-06T01:00:00Z", 30);
    expect(grid.endLabel).toBe("01:00");
    const blocked = blockedFromAvailability(grid, { unavailable: [{ start: "23:30", end: "01:00" }] });
    expect(blocked).toEqual([false, false, false, true, true, true]);
    expect(availabilityFromBlocked(grid, blocked).unavailable).toEqual([{ start: "23:30", end: "01:00" }]);
  });

  it("findet zu kurze verfügbare Spannen", () => {
    const grid = buildAvailabilityGrid("2026-11-05T18:00:00Z", "2026-11-05T21:00:00Z", 30);
    const blocked = [false, true, true, true, false, false];
    expect(shortAvailableRuns(grid, blocked, 60)).toEqual([{ start: "18:00", end: "18:30" }]);
  });
});
