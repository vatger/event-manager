import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeEventCapabilities, type EventActor } from "../eventCapabilities";
import { changedFields, requiredCapabilities } from "../eventChangeRules";
import type { PermissionKey } from "@/lib/acl/catalog";

const plain = { firCode: "EDMM", isResponsible: false, isRosterEditor: false };

function member(perms: PermissionKey[], fir = "EDMM"): EventActor {
  return {
    effectiveLevel: "USER",
    firScopedPermissions: { [fir]: perms },
    firLevels: { [fir]: "FIR_TEAM" },
  };
}

describe("computeEventCapabilities", () => {
  const previous = process.env.MAIN_ADMIN_CIDS;
  beforeEach(() => {
    process.env.MAIN_ADMIN_CIDS = "";
  });
  afterEach(() => {
    process.env.MAIN_ADMIN_CIDS = previous;
  });

  it("gibt mit Stammdaten-Recht nur Stammdaten, Verantwortliche und Aufgaben", () => {
    const c = computeEventCapabilities(member(["event.edit"]), plain);
    expect(c.editDetails && c.manageResponsibles && c.manageTasks).toBe(true);
    expect(c.banner || c.signupPhase || c.publishRoster || c.editRoster || c.manageSignups).toBe(false);
    expect(c.delete).toBe(false);
  });

  it("trennt Banner, Anmeldephase und Veröffentlichen", () => {
    expect(computeEventCapabilities(member(["event.banner"]), plain).banner).toBe(true);
    expect(computeEventCapabilities(member(["signups.phase"]), plain).signupPhase).toBe(true);
    const publisher = computeEventCapabilities(member(["roster.publish"]), plain);
    expect(publisher.publishRoster).toBe(true);
    expect(publisher.editDetails).toBe(false);
  });

  it("gibt Verantwortlichen Banner, Anmeldephase, Aufgaben und Besetzungsplan ihres Events", () => {
    const c = computeEventCapabilities(member([]), { ...plain, isResponsible: true });
    expect(c.banner && c.signupPhase && c.manageTasks && c.editRoster && c.manageSignups).toBe(true);
    expect(c.editDetails || c.delete || c.publishRoster || c.manageResponsibles).toBe(false);
  });

  it("lässt jedes Teammitglied sich selbst eintragen, Fremde nicht", () => {
    expect(computeEventCapabilities(member([]), plain).selfAssign).toBe(true);
    expect(computeEventCapabilities(member(["event.edit"], "EDWW"), plain).selfAssign).toBe(false);
    expect(computeEventCapabilities(member(["event.edit"], "EDWW"), plain).editDetails).toBe(false);
    expect(computeEventCapabilities(null, plain).selfAssign).toBe(false);
  });

  it("gibt der VATGER-Eventleitung alles", () => {
    const vatger: EventActor = { effectiveLevel: "VATGER_LEITUNG", firScopedPermissions: {}, firLevels: {} };
    const c = computeEventCapabilities(vatger, plain);
    expect(Object.entries(c).filter(([k, v]) => k !== "isResponsible" && !v)).toEqual([]);
  });

  it("macht ausdrückliche Roster-Bearbeiter zu Bearbeitern dieses Plans", () => {
    const c = computeEventCapabilities(member([]), { ...plain, isRosterEditor: true });
    expect(c.editRoster && c.manageSignups).toBe(true);
    expect(c.publishRoster).toBe(false);
  });
});

describe("Änderungsregeln", () => {
  const stored = {
    name: "Munich Overload",
    description: "",
    status: "PLANNING",
    signupDeadline: null,
    bannerUrl: null,
    startTime: new Date("2026-12-01T16:00:00.000Z"),
    airports: ["EDDM"],
    rosterlink: null,
  };

  it("erkennt nur echte Änderungen – das Formular schickt alles mit", () => {
    expect(
      changedFields(stored, {
        name: "Munich Overload",
        description: null,
        status: "PLANNING",
        signupDeadline: null,
        bannerUrl: "",
        startTime: "2026-12-01T16:00:00.000Z",
        airports: ["EDDM"],
        rosterlink: null,
      })
    ).toEqual([]);
  });

  it("verlangt je Feld das passende Recht", () => {
    const fields = changedFields(stored, {
      name: "Neu",
      bannerUrl: "https://example.org/b.png",
      signupDeadline: "2026-11-30T20:00:00.000Z",
    });
    expect(requiredCapabilities(fields, undefined).sort()).toEqual(
      ["banner", "editDetails", "signupPhase"].sort()
    );
  });

  it("ordnet Statuswechsel zu: Anmeldephase, Veröffentlichen, sonst Stammdaten", () => {
    expect(requiredCapabilities(["status"], "SIGNUP_OPEN")).toEqual(["signupPhase"]);
    expect(requiredCapabilities(["status"], "SIGNUP_CLOSED")).toEqual(["signupPhase"]);
    expect(requiredCapabilities(["status", "rosterlink"], "ROSTER_PUBLISHED")).toEqual(["publishRoster"]);
    expect(requiredCapabilities(["status"], "CANCELLED")).toEqual(["editDetails"]);
    expect(requiredCapabilities(["status"], "PLANNING")).toEqual(["editDetails"]);
  });
});
