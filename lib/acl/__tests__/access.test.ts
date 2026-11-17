import { describe, expect, it } from "vitest";
import { explainPermissions } from "../access";
import { PERMISSION_CATALOG, PERMISSION_KEYS } from "../catalog";

const find = (result: ReturnType<typeof explainPermissions>, key: string) =>
  result.find((p) => p.key === key)!;

describe("explainPermissions", () => {
  it("listet jedes Recht des Katalogs, auch nicht vergebene", () => {
    const result = explainPermissions([]);
    expect(result.map((p) => p.key)).toEqual([...PERMISSION_KEYS]);
    expect(result.every((p) => !p.granted)).toBe(true);
  });

  it("nennt die Gruppe, die ein Recht direkt vergibt", () => {
    const result = explainPermissions([
      { name: "Eventteam", kind: "CUSTOM", permissions: ["user.notif"] },
    ]);
    expect(find(result, "user.notif")).toEqual({
      key: "user.notif",
      granted: true,
      sources: [{ type: "group", groupName: "Eventteam" }],
    });
    expect(find(result, "event.edit").granted).toBe(false);
  });

  it("erklärt Rechte, die in einem anderen enthalten sind", () => {
    const result = explainPermissions([
      { name: "Planer", kind: "CUSTOM", permissions: ["roster.edit"] },
    ]);
    expect(find(result, "signups.manage").sources).toEqual([
      { type: "included", groupName: "Planer", via: "roster.edit" },
    ]);
    // Nicht enthaltene Rechte bleiben verwehrt
    expect(find(result, "roster.publish").granted).toBe(false);
  });

  it("schließt mit „Stammdaten bearbeiten“ keine anderen Rechte mehr ein", () => {
    const result = explainPermissions([
      { name: "Stammdaten", kind: "CUSTOM", permissions: ["event.edit"] },
    ]);
    expect(result.filter((p) => p.granted).map((p) => p.key)).toEqual(["event.edit"]);
  });

  it("gibt über die Leitungsgruppe jedes Recht außer den nur ausdrücklich vergebenen", () => {
    const result = explainPermissions([{ name: "EDMM Eventleitung", kind: "FIR_LEITUNG", permissions: [] }]);
    expect(result.filter((p) => !p.granted).map((p) => p.key)).toEqual(["roster.contact"]);
    expect(find(result, "event.delete").sources).toEqual([
      { type: "leitung", groupName: "EDMM Eventleitung" },
    ]);
  });

  it("führt alle Quellen auf, wenn mehrere Gruppen dasselbe Recht geben", () => {
    const result = explainPermissions([
      { name: "A", kind: "CUSTOM", permissions: ["signups.manage"] },
      { name: "B", kind: "CUSTOM", permissions: ["roster.edit"] },
    ]);
    expect(find(result, "signups.manage").sources).toEqual([
      { type: "group", groupName: "A" },
      { type: "included", groupName: "B", via: "roster.edit" },
    ]);
  });
});

describe("Rechtekatalog", () => {
  it("beschreibt jeden Schlüssel genau einmal", () => {
    expect(PERMISSION_CATALOG.map((p) => p.key).sort()).toEqual([...PERMISSION_KEYS].sort());
  });

  it("verweist in 'includes' nur auf Rechte des Katalogs", () => {
    for (const def of PERMISSION_CATALOG) {
      for (const included of def.includes ?? []) {
        expect(PERMISSION_KEYS).toContain(included);
      }
    }
  });
});
