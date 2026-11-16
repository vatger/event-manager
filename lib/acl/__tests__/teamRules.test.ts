import { describe, expect, it } from "vitest";
import {
  canAccessTeamArea,
  canCreateGroup,
  canDeleteGroup,
  canEditGroup,
  canEditGroupPermissions,
  canManageDepartment,
  canManageGroupMembers,
  canManageVatgerLeitung,
  canViewVatgerLeitung,
  manageableDepartments,
  type TeamActor,
} from "../teamRules";

const mainAdmin: TeamActor = { effectiveLevel: "MAIN_ADMIN", firLevels: {} };
const vatger: TeamActor = { effectiveLevel: "VATGER_LEITUNG", firLevels: { EDMM: "FIR_TEAM" } };
const edmmLead: TeamActor = { effectiveLevel: "FIR_EVENTLEITER", firLevels: { EDMM: "FIR_EVENTLEITER" } };
const edmmMember: TeamActor = { effectiveLevel: "USER", firLevels: { EDMM: "FIR_TEAM" } };
const outsider: TeamActor = { effectiveLevel: "USER", firLevels: {} };

const leitung = (firCode: string) => ({ kind: "FIR_LEITUNG", firCode });
const subgroup = (firCode: string) => ({ kind: "CUSTOM", firCode });

describe("Zugang zum Bereich", () => {
  it("haben Leitung, VATGER-Eventleitung und Main-Admin", () => {
    expect(canAccessTeamArea(mainAdmin)).toBe(true);
    expect(canAccessTeamArea(vatger)).toBe(true);
    expect(canAccessTeamArea(edmmLead)).toBe(true);
  });

  it("haben normale Teammitglieder und Außenstehende nicht", () => {
    expect(canAccessTeamArea(edmmMember)).toBe(false);
    expect(canAccessTeamArea(outsider)).toBe(false);
  });

  it("beschränkt die FIR-Leitung auf ihr eigenes Department", () => {
    expect(manageableDepartments(edmmLead)).toEqual(["EDMM"]);
    expect(manageableDepartments(vatger)).toBe("ALL");
    expect(canManageDepartment(edmmLead, "EDMM")).toBe(true);
    expect(canManageDepartment(edmmLead, "EDWW")).toBe(false);
    expect(canManageDepartment(edmmMember, "EDMM")).toBe(false);
  });
});

describe("Untergruppen", () => {
  it("verwaltet die FIR-Leitung im eigenen Department vollständig", () => {
    expect(canCreateGroup(edmmLead, "EDMM")).toBe(true);
    expect(canEditGroup(edmmLead, subgroup("EDMM"))).toBe(true);
    expect(canDeleteGroup(edmmLead, subgroup("EDMM"))).toBe(true);
    expect(canEditGroupPermissions(edmmLead, subgroup("EDMM"))).toBe(true);
    expect(canManageGroupMembers(edmmLead, subgroup("EDMM"))).toBe(true);
  });

  it("sind für die Leitung einer anderen FIR tabu", () => {
    expect(canCreateGroup(edmmLead, "EDWW")).toBe(false);
    expect(canEditGroup(edmmLead, subgroup("EDWW"))).toBe(false);
    expect(canDeleteGroup(edmmLead, subgroup("EDWW"))).toBe(false);
    expect(canEditGroupPermissions(edmmLead, subgroup("EDWW"))).toBe(false);
    expect(canManageGroupMembers(edmmLead, subgroup("EDWW"))).toBe(false);
  });

  it("sind für normale Teammitglieder tabu", () => {
    expect(canCreateGroup(edmmMember, "EDMM")).toBe(false);
    expect(canEditGroupPermissions(edmmMember, subgroup("EDMM"))).toBe(false);
    expect(canManageGroupMembers(edmmMember, subgroup("EDMM"))).toBe(false);
  });
});

describe("Leitungsgruppe", () => {
  it("kann die FIR-Leitung weder umbenennen noch besetzen", () => {
    expect(canEditGroup(edmmLead, leitung("EDMM"))).toBe(false);
    expect(canManageGroupMembers(edmmLead, leitung("EDMM"))).toBe(false);
  });

  it("besetzt die VATGER-Eventleitung in jeder FIR", () => {
    expect(canManageGroupMembers(vatger, leitung("EDWW"))).toBe(true);
    expect(canEditGroup(vatger, leitung("EDWW"))).toBe(true);
    expect(canManageGroupMembers(mainAdmin, leitung("EDGG"))).toBe(true);
  });

  it("ist für niemanden löschbar und hat feste Rechte", () => {
    for (const actor of [mainAdmin, vatger, edmmLead]) {
      expect(canDeleteGroup(actor, leitung("EDMM"))).toBe(false);
      expect(canEditGroupPermissions(actor, leitung("EDMM"))).toBe(false);
    }
  });
});

describe("VATGER-Eventleitung", () => {
  it("sehen VATGER-Eventleitung und Main-Admin, ernennen nur der Main-Admin", () => {
    expect(canViewVatgerLeitung(vatger)).toBe(true);
    expect(canViewVatgerLeitung(edmmLead)).toBe(false);
    expect(canManageVatgerLeitung(mainAdmin)).toBe(true);
    expect(canManageVatgerLeitung(vatger)).toBe(false);
  });
});
