import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEITUNG_PERMISSION_KEYS } from "../catalog";
import { computeEffectiveData, type AclSubject } from "../effective";

const MAIN_ADMIN = 1000001;

type GroupInput = { kind: "FIR_LEITUNG" | "CUSTOM"; fir: string | null; permissions?: string[] };

function subject(
  groups: GroupInput[],
  options: { cid?: number; vatgerLeitung?: boolean } = {}
): AclSubject {
  return {
    cid: options.cid ?? 1234567,
    vatgerLeitung: options.vatgerLeitung ? { id: 1 } : null,
    groups: groups.map((g) => ({
      group: {
        kind: g.kind,
        fir: g.fir ? { code: g.fir } : null,
        permissions: (g.permissions ?? []).map((key) => ({ permission: { key } })),
      },
    })),
  };
}

describe("computeEffectiveData", () => {
  const previous = process.env.MAIN_ADMIN_CIDS;
  beforeEach(() => {
    process.env.MAIN_ADMIN_CIDS = String(MAIN_ADMIN);
  });
  afterEach(() => {
    process.env.MAIN_ADMIN_CIDS = previous;
  });

  it("gibt einem Nutzer ohne Gruppen nichts", () => {
    const data = computeEffectiveData(subject([]));
    expect(data.effectiveLevel).toBe("USER");
    expect(data.effectivePermissions).toEqual([]);
    expect(data.firScopedPermissions).toEqual({});
    expect(data.firLevels).toEqual({});
  });

  it("vergibt die Rechte einer Untergruppe nur in deren FIR", () => {
    const data = computeEffectiveData(
      subject([{ kind: "CUSTOM", fir: "EDMM", permissions: ["event.edit", "user.notif"] }])
    );
    expect(data.effectiveLevel).toBe("USER");
    expect(data.firLevels).toEqual({ EDMM: "FIR_TEAM" });
    expect(data.firScopedPermissions).toEqual({ EDMM: ["event.edit", "user.notif"] });
    expect(data.firScopedPermissions.EDWW).toBeUndefined();
  });

  it("macht jedes Gruppenmitglied zum Teammitglied – auch ohne Rechte", () => {
    const data = computeEffectiveData(subject([{ kind: "CUSTOM", fir: "EDGG" }]));
    expect(data.firLevels).toEqual({ EDGG: "FIR_TEAM" });
    expect(data.firScopedPermissions).toEqual({ EDGG: [] });
  });

  it("gibt der Leitungsgruppe fest alle Rechte des Katalogs", () => {
    const data = computeEffectiveData(subject([{ kind: "FIR_LEITUNG", fir: "EDMM" }]));
    expect(data.effectiveLevel).toBe("FIR_EVENTLEITER");
    expect(data.firLevels).toEqual({ EDMM: "FIR_EVENTLEITER" });
    expect(data.firScopedPermissions.EDMM).toEqual(LEITUNG_PERMISSION_KEYS);
    // Ansprechpartner wird nur ausdrücklich vergeben
    expect(data.firScopedPermissions.EDMM).not.toContain("roster.contact");
    // …aber nicht global
    expect(data.effectivePermissions).toEqual([]);
  });

  it("vergibt nur ausdrücklich vergebene Rechte über eine Untergruppe – auch an die Leitung", () => {
    const data = computeEffectiveData(
      subject([
        { kind: "FIR_LEITUNG", fir: "EDMM" },
        { kind: "CUSTOM", fir: "EDMM", permissions: ["roster.contact"] },
      ])
    );
    expect(data.firScopedPermissions.EDMM).toContain("roster.contact");
  });

  it("behält die Leitungsrolle unabhängig von der Reihenfolge der Gruppen", () => {
    const data = computeEffectiveData(
      subject([
        { kind: "FIR_LEITUNG", fir: "EDMM" },
        { kind: "CUSTOM", fir: "EDMM", permissions: ["user.notif"] },
      ])
    );
    expect(data.firLevels.EDMM).toBe("FIR_EVENTLEITER");
  });

  it("führt Rechte mehrerer Gruppen ohne Duplikate zusammen", () => {
    const data = computeEffectiveData(
      subject([
        { kind: "CUSTOM", fir: "EDMM", permissions: ["event.edit", "roster.edit"] },
        { kind: "CUSTOM", fir: "EDMM", permissions: ["roster.edit", "user.notif"] },
      ])
    );
    expect(data.firScopedPermissions.EDMM).toEqual(["event.edit", "roster.edit", "user.notif"]);
  });

  it("ignoriert Schlüssel außerhalb des Katalogs", () => {
    const data = computeEffectiveData(
      subject([{ kind: "CUSTOM", fir: "EDMM", permissions: ["event.manage", "fir.manage", "event.edit"] }])
    );
    expect(data.firScopedPermissions.EDMM).toEqual(["event.edit"]);
  });

  it("ignoriert Gruppen ohne FIR – FIR-übergreifend gibt es keine Gruppenrechte", () => {
    const data = computeEffectiveData(
      subject([{ kind: "CUSTOM", fir: null, permissions: ["event.edit"] }])
    );
    expect(data.effectivePermissions).toEqual([]);
    expect(data.firScopedPermissions).toEqual({});
    expect(data.firLevels).toEqual({});
  });

  it("gibt der VATGER-Eventleitung alles, auch mit eigener FIR-Zugehörigkeit", () => {
    const data = computeEffectiveData(
      subject([{ kind: "CUSTOM", fir: "EDMM", permissions: ["user.notif"] }], { vatgerLeitung: true })
    );
    expect(data.effectiveLevel).toBe("VATGER_LEITUNG");
    expect(data.effectivePermissions).toEqual(["*"]);
    expect(data.firLevels).toEqual({ EDMM: "FIR_TEAM" });
  });

  it("stuft einen Main-Admin nicht zur VATGER-Leitung herab", () => {
    const data = computeEffectiveData(subject([], { cid: MAIN_ADMIN, vatgerLeitung: true }));
    expect(data.effectiveLevel).toBe("MAIN_ADMIN");
    expect(data.effectivePermissions).toEqual(["*"]);
  });
});
