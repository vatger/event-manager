import { describe, expect, it } from "vitest";
import { describeEventChanges, diffEvent, formatZulu } from "../eventActivityFormat";

const before = {
  name: "Munich Overload",
  description: "<p>Alt</p>",
  status: "PLANNING",
  startTime: new Date("2026-12-01T16:00:00.000Z"),
  endTime: new Date("2026-12-01T21:00:00.000Z"),
  airports: ["EDDM"],
  staffedStations: ["EDDM_TWR"],
  signupDeadline: null,
  bannerUrl: null,
  bannerVisible: false,
  rosterlink: null,
};

describe("Event-Protokoll: Formulierungen", () => {
  it("schreibt Zeiten im Zulu-Format", () => {
    expect(formatZulu("2026-12-01T16:05:00.000Z")).toBe("01.12.2026 16:05z");
  });

  it("findet nur echte Änderungen, auch bei anderem Format", () => {
    expect(
      diffEvent(before, {
        ...before,
        startTime: "2026-12-01T16:00:00.000Z",
        airports: JSON.stringify(["EDDM"]),
        bannerUrl: "",
      })
    ).toEqual([]);
  });

  it("fasst Stammdaten zu einem Eintrag zusammen und listet Vorher/Nachher", () => {
    const drafts = describeEventChanges(before, {
      ...before,
      name: "Munich Overload 2",
      staffedStations: ["EDDM_TWR", "EDDM_APP"],
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      category: "details",
      action: "details_changed",
      summary: "Name und Stationen geändert",
    });
    expect(drafts[0].details).toEqual({
      changes: [
        { field: "name", label: "Name", before: "Munich Overload", after: "Munich Overload 2" },
        { field: "staffedStations", label: "Stationen", before: "EDDM_TWR", after: "EDDM_TWR, EDDM_APP" },
      ],
    });
  });

  it("trennt Status, Banner und Anmeldeschluss in eigene Einträge", () => {
    const drafts = describeEventChanges(before, {
      ...before,
      status: "SIGNUP_OPEN",
      signupDeadline: "2026-11-28T20:00:00.000Z",
      bannerUrl: "https://example.org/b.png",
      bannerVisible: true,
    });
    expect(drafts.map((d) => d.summary)).toEqual([
      "Status von „Planung“ auf „Anmeldung offen“ gesetzt",
      "Anmeldeschluss auf 28.11.2026 20:00z gesetzt",
      "Banner hinzugefügt",
      "Banner öffentlich geschaltet",
    ]);
  });

  it("nennt eine Absage als solche", () => {
    const drafts = describeEventChanges(before, { ...before, status: "CANCELLED" });
    expect(drafts).toEqual([
      expect.objectContaining({ action: "event_cancelled", summary: "Event abgesagt" }),
    ]);
  });

  it("schreibt beim Verschieben des Anmeldeschlusses beide Zeiten", () => {
    const drafts = describeEventChanges(
      { ...before, signupDeadline: new Date("2026-11-28T20:00:00.000Z") },
      { signupDeadline: "2026-11-29T18:00:00.000Z" }
    );
    expect(drafts[0].summary).toBe(
      "Anmeldeschluss von 28.11.2026 20:00z auf 29.11.2026 18:00z verschoben"
    );
  });

  it("kürzt die Beschreibung auf Text", () => {
    const drafts = describeEventChanges(before, { description: "<p>Neu <b>mit</b> HTML</p>" });
    expect((drafts[0].details as { changes: Array<{ after: string }> }).changes[0].after).toBe(
      "Neu mit HTML"
    );
  });
});
