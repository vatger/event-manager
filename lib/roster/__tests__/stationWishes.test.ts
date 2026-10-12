import { describe, expect, it } from "vitest";
import { parseStationWishes, type WishStation } from "../stationWishes";

/** Ausschnitt der echten Datahub-Daten */
const STATIONS: WishStation[] = [
  { callsign: "EDDM_DEL", description: "München Delivery", abbreviation: "DMC" },
  { callsign: "EDDM_1_GND", description: "München Apron (Apron 1)", abbreviation: "DMG1" },
  { callsign: "EDDM_2_GND", description: "München Apron (Apron 2)", abbreviation: "DMG2" },
  { callsign: "EDDM_3_GND", description: "München Apron (Apron 3)", abbreviation: "DMG3" },
  { callsign: "EDDM_N_GND", description: "München Ground (North)", abbreviation: "DMGN" },
  { callsign: "EDDM_S_GND", description: "München Ground (South)", abbreviation: "DMGS" },
  { callsign: "EDDM_N_TWR", description: "München Tower (North)", abbreviation: "DMTN" },
  { callsign: "EDDM_S_TWR", description: "München Tower (South)", abbreviation: "DMTS" },
  { callsign: "EDDM_NH_APP", description: "München Radar (North High)", abbreviation: "DMNH" },
  { callsign: "EDDM_SH_APP", description: "München Radar (South High)", abbreviation: "DMSH" },
  { callsign: "EDDM_ND_APP", description: "München Arrival (North Director)", abbreviation: "DMND" },
  { callsign: "EDMM_ZUG_CTR", description: "München Radar (Zugspitze)", abbreviation: "ZUG" },
  { callsign: "EDMM_WLD_CTR", description: "München Radar (Walda)", abbreviation: "WLD" },
  { callsign: "EDDN_DEL", description: "Nürnberg Delivery" },
  { callsign: "EDDN_GND", description: "Nürnberg Ground", abbreviation: "DNG" },
  { callsign: "EDDN_TWR", description: "Nürnberg Tower", abbreviation: "DNT" },
  { callsign: "EDDN_D_APP", description: "Nürnberg Arrival", abbreviation: "DND" },
];

const parse = (text: string) => parseStationWishes(text, STATIONS);
const preferred = (text: string) => [...parse(text).preferred.keys()].sort();
const avoided = (text: string) => [...parse(text).avoided].sort();

describe("parseStationWishes", () => {
  it("versteht APN als die Apron-Positionen", () => {
    expect(preferred("ne Runde APN")).toEqual(["EDDM_1_GND", "EDDM_2_GND", "EDDM_3_GND"]);
    expect(preferred("Vorfeld")).toEqual(["EDDM_1_GND", "EDDM_2_GND", "EDDM_3_GND"]);
  });

  it('liest „kein DEL" als: keine Delivery-Station', () => {
    expect(avoided("kein DEL")).toEqual(["EDDM_DEL", "EDDN_DEL"]);
    expect(preferred("kein DEL")).toEqual([]);
    expect(avoided("alles außer Delivery")).toEqual(["EDDM_DEL", "EDDN_DEL"]);
    expect(avoided("bitte keine Clearance")).toEqual(["EDDM_DEL", "EDDN_DEL"]);
  });

  it("trennt Wunsch und Abneigung im selben Text", () => {
    const w = parse("keine Delivery, gern Tower");
    expect([...w.avoided].sort()).toEqual(["EDDM_DEL", "EDDN_DEL"]);
    expect([...w.preferred.keys()].sort()).toEqual(["EDDM_N_TWR", "EDDM_S_TWR", "EDDN_TWR"]);
  });

  it("verneint bis zum Satzende", () => {
    expect(avoided("kein DEL oder GND")).toEqual([
      "EDDM_1_GND",
      "EDDM_2_GND",
      "EDDM_3_GND",
      "EDDM_DEL",
      "EDDM_N_GND",
      "EDDM_S_GND",
      "EDDN_DEL",
      "EDDN_GND",
    ]);
  });

  it("nimmt IATA-Codes, Richtungen und Kurzlisten", () => {
    expect(preferred("MUC TWR N/S")).toEqual(["EDDM_N_TWR", "EDDM_S_TWR"]);
    expect(preferred("Tower Nord")).toEqual(["EDDM_N_TWR"]);
    expect(preferred("Apron 1 oder 2")).toEqual(["EDDM_1_GND", "EDDM_2_GND"]);
    expect(preferred("Nürnberg Tower")).toEqual(["EDDN_TWR"]);
    expect(preferred("NUE APP")).toEqual(["EDDN_D_APP"]);
  });

  it("erkennt Sektoren an Namen und Kürzel", () => {
    expect(preferred("Zugspitze")).toEqual(["EDMM_ZUG_CTR"]);
    expect(preferred("ZUG")).toEqual(["EDMM_ZUG_CTR"]);
    expect(preferred("Center Walda")).toEqual(["EDMM_WLD_CTR"]);
  });

  it("nimmt genaue Callsigns wörtlich", () => {
    expect(preferred("EDDM_N_TWR")).toEqual(["EDDM_N_TWR"]);
    expect(preferred("eddm n twr")).toEqual(["EDDM_N_TWR"]);
  });

  it("gewichtet nach Reihenfolge", () => {
    const w = parse("1. APP 2. TWR");
    expect(w.preferred.get("EDDM_NH_APP")).toBe(1);
    expect(w.preferred.get("EDDN_D_APP")).toBe(1);
    expect(w.preferred.get("EDDM_N_TWR")).toBeCloseTo(0.8);
  });

  it("lässt Verneinung den allgemeinen Wunsch überstimmen", () => {
    const w = parse("TWR, aber nicht S");
    expect([...w.preferred.keys()].sort()).toEqual(["EDDM_N_TWR", "EDDN_TWR"]);
    expect([...w.avoided]).toEqual(["EDDM_S_TWR"]);
  });

  it("überliest Füllwerk", () => {
    expect(preferred("egal")).toEqual([]);
    expect(preferred("bin flexibel, gerne auch länger")).toEqual([]);
    expect(preferred("")).toEqual([]);
  });

  it("verwechselt Tower nicht mit Ground North", () => {
    expect(preferred("Tower N")).toEqual(["EDDM_N_TWR"]);
  });
});
