import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkEligibility } from "@/app/admin/events/[id]/roster/_lib/rosterUtils";
import type { RosterController, StationMeta } from "@/app/admin/events/[id]/roster/_lib/rosterTypes";
import type { EventEndorsementData } from "@/lib/cache/types";
import { canStaffStation } from "@/lib/weeklys/stationUtils";

/**
 * Die automatische Planung nutzt dieselbe Eignungsprüfung wie der Editor.
 * Hier der Sonderfall S1-TWR zusammen mit dem S1-Theorie-Roster.
 */

function s1(levels: EventEndorsementData["allowedLevels"], s1TheoryOnly: boolean): RosterController {
  const endorsement: EventEndorsementData = {
    group: "GND",
    allowedLevels: levels,
    restrictions: [],
    familiarizations: [],
    ctrEndorsements: [],
    soloPositions: [],
  };
  return {
    cid: 1,
    name: "Test",
    rating: "S1",
    entry: {
      id: 1,
      user: { cid: 1, name: "Test", rating: "S1" },
      remarks: null,
      availability: {},
      endorsement,
      airportEndorsements: { EDDW: endorsement },
      s1TheoryOnly,
    },
    unavailable: [],
    hasAvailability: false,
    preferredStations: "",
    remarks: null,
    withdrawn: false,
  };
}

function tower(s1Twr: boolean): StationMeta {
  return {
    callsign: "EDDW_TWR",
    group: "TWR",
    airport: "EDDW",
    s1Twr,
    requiredFamiliarizations: [],
    gcapStatus: null,
  };
}

describe("Eignung: S1-TWR und S1-Theorie-Roster", () => {
  it("lässt reguläre S1 auf einen S1-Tower", () => {
    assert.equal(checkEligibility(s1(["DEL", "GND"], false), tower(true), ["EDDW"]).ok, true);
  });

  it("lässt S1 nicht auf einen Tower ohne s1_twr", () => {
    assert.equal(checkEligibility(s1(["DEL", "GND"], false), tower(false), ["EDDW"]).ok, false);
  });

  it("lässt S1-Theorie-Roster nur zu, wenn die Freigaben TWR enthalten", () => {
    // Ohne s1_theory am Tower kommt TWR nicht in die Ebenen – dann kein Sonderweg über GND
    assert.equal(checkEligibility(s1(["DEL", "GND"], true), tower(true), ["EDDW"]).ok, false);
    // Mit s1_theory steht TWR bereits in den Ebenen
    assert.equal(checkEligibility(s1(["DEL", "GND", "TWR"], true), tower(true), ["EDDW"]).ok, true);
  });
});

describe("canStaffStation (Server, Weekly-Roster, Rückfall ohne Ebenenliste)", () => {
  it("lässt GND auf einen S1-Tower, aber nicht vom Theory Roster", () => {
    assert.equal(canStaffStation("GND", "TWR", true), true);
    assert.equal(canStaffStation("GND", "TWR", true, false), true);
    assert.equal(canStaffStation("GND", "TWR", true, true), false);
    assert.equal(canStaffStation("GND", "TWR", false), false);
  });

  it("gilt auch im Rückfall der Eignungsprüfung ohne Ebenenliste", () => {
    const c = s1(["DEL", "GND"], true);
    // Ältere zwischengespeicherte Anmeldung ohne allowedLevels
    delete (c.entry.endorsement as Partial<EventEndorsementData>).allowedLevels;
    delete (c.entry.airportEndorsements!.EDDW as Partial<EventEndorsementData>).allowedLevels;
    assert.equal(checkEligibility(c, tower(true), ["EDDW"]).ok, false);
    c.entry.s1TheoryOnly = false;
    assert.equal(checkEligibility(c, tower(true), ["EDDW"]).ok, true);
  });
});
