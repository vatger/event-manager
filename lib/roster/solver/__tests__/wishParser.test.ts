import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePartners, parseWishes, type WishStation } from "../wishParser";

const STATIONS: WishStation[] = [
  { callsign: "EDDF_DEL", group: "DEL", airport: "EDDF" },
  { callsign: "EDDF_GND", group: "GND", airport: "EDDF" },
  { callsign: "EDDF_N_TWR", group: "TWR", airport: "EDDF" },
  { callsign: "EDDF_S_TWR", group: "TWR", airport: "EDDF" },
  { callsign: "EDDF_N_APP", group: "APP", airport: "EDDF" },
  { callsign: "EDDM_TWR", group: "TWR", airport: "EDDM" },
  { callsign: "EDDM_GND", group: "GND", airport: "EDDM" },
  { callsign: "EDGG_DKB_CTR", group: "CTR", airport: null, abbreviation: "DKB" },
  { callsign: "EDMM_ZUG_CTR", group: "CTR", airport: null, abbreviation: "ZUG" },
];

const parse = (text: string | null | undefined) => parseWishes(text, STATIONS);

describe("Wünsche aus dem Freitext", () => {
  it("liefert für leere oder beliebige Angaben nichts", () => {
    for (const text of [null, undefined, "", "egal", "Alles", "flexible", "-"]) {
      assert.deepEqual(parse(text), { preferredStations: [], avoidedStations: [] }, String(text));
    }
  });

  it("erkennt vollständige Callsigns in verschiedenen Schreibweisen", () => {
    assert.deepEqual(parse("EDDF_N_TWR").preferredStations, ["EDDF_N_TWR"]);
    assert.deepEqual(parse("eddf n twr").preferredStations, ["EDDF_N_TWR"]);
    assert.deepEqual(parse("EDDF-S-TWR").preferredStations, ["EDDF_S_TWR"]);
  });

  it("übernimmt die Reihenfolge als Rangfolge", () => {
    assert.deepEqual(parse("EDDM_TWR > EDDF_GND, EDDF_DEL").preferredStations, [
      "EDDM_TWR",
      "EDDF_GND",
      "EDDF_DEL",
    ]);
    assert.deepEqual(parse("EDDF_GND oder EDDM_TWR").preferredStations, ["EDDF_GND", "EDDM_TWR"]);
  });

  it("erkennt Datahub-Kürzel", () => {
    assert.deepEqual(parse("DKB > ZUG").preferredStations, ["EDGG_DKB_CTR", "EDMM_ZUG_CTR"]);
  });

  it("erkennt Ebenen, auch auf einen Airport eingegrenzt", () => {
    assert.deepEqual(parse("Tower").preferredStations, ["EDDF_N_TWR", "EDDF_S_TWR", "EDDM_TWR"]);
    assert.deepEqual(parse("EDDM Tower").preferredStations, ["EDDM_TWR"]);
    assert.deepEqual(parse("Center").preferredStations, ["EDGG_DKB_CTR", "EDMM_ZUG_CTR"]);
  });

  it("nimmt bei einem bloßen Airport alle seine Stationen", () => {
    assert.deepEqual(parse("EDDM").preferredStations, ["EDDM_TWR", "EDDM_GND"]);
  });

  it("wertet Verneinungen als „will nicht“", () => {
    const r = parse("Tower, kein DEL");
    assert.deepEqual(r.avoidedStations, ["EDDF_DEL"]);
    assert.ok(r.preferredStations.includes("EDDF_N_TWR"));
  });

  it("lässt die Verneinung nur bis zum nächsten Trenner gelten", () => {
    const r = parse("Tower, kein DEL, APP");
    assert.deepEqual(r.avoidedStations, ["EDDF_DEL"]);
    assert.ok(r.preferredStations.includes("EDDF_N_APP"));
  });

  it("lässt „außer“ über ein „und“ hinweg gelten", () => {
    const r = parse("alles außer DEL und GND");
    assert.deepEqual(r.avoidedStations.sort(), ["EDDF_DEL", "EDDF_GND", "EDDM_GND"]);
  });

  it("lässt „kein“ über ein „und“/„oder“ hinweg gelten", () => {
    const r = parse("kein DEL und GND");
    assert.deepEqual(r.avoidedStations.sort(), ["EDDF_DEL", "EDDF_GND", "EDDM_GND"]);
    assert.deepEqual(r.preferredStations, []);
    assert.deepEqual(parse("no delivery or ground").preferredStations, []);
  });

  it("lässt „außer“ über ein Komma hinweg gelten", () => {
    assert.deepEqual(parse("alles außer DEL, EDDM_GND").avoidedStations, ["EDDF_DEL", "EDDM_GND"]);
  });

  it("beendet die Verneinung vor „dann“", () => {
    const r = parse("kein DEL dann Tower");
    assert.deepEqual(r.avoidedStations, ["EDDF_DEL"]);
    assert.ok(r.preferredStations.includes("EDDM_TWR"));
  });

  it("versteht englische Verneinungen", () => {
    assert.deepEqual(parse("no delivery").avoidedStations, ["EDDF_DEL"]);
  });

  it("führt nichts zugleich als Wunsch und Ablehnung", () => {
    const r = parse("EDDF_GND, nicht EDDF_GND");
    assert.deepEqual(r.preferredStations, []);
    assert.deepEqual(r.avoidedStations, ["EDDF_GND"]);
  });

  it("ignoriert Stationen, die es im Plan nicht gibt", () => {
    assert.deepEqual(parse("EDDH_TWR"), { preferredStations: [], avoidedStations: [] });
  });
  it("verneint bei „außer“ alle folgenden Listeneinträge, aber nicht über „dann“", () => {
    assert.deepEqual(parse("alles außer DEL, GND, TWR").preferredStations, []);
    assert.ok(parse("alles außer DEL, GND, TWR").avoidedStations.includes("EDDM_TWR"));
    const r = parse("alles außer DEL dann TWR");
    assert.deepEqual(r.avoidedStations, ["EDDF_DEL"]);
    assert.deepEqual(r.preferredStations, ["EDDF_N_TWR", "EDDF_S_TWR", "EDDM_TWR"]);
  });

  it("verneint bei einer Verneinung mitten im Abschnitt nur das Folgende", () => {
    const twr = ["EDDF_N_TWR", "EDDF_S_TWR", "EDDM_TWR"];
    for (const text of ["Tower ohne Ground", "TWR except GND", "Tower but no Ground"]) {
      assert.deepEqual(parse(text).preferredStations, twr, text);
      assert.deepEqual(parse(text).avoidedStations, ["EDDF_GND", "EDDM_GND"], text);
    }
    const r = parse("Tower ohne DEL, APP");
    assert.deepEqual(r.preferredStations, [...twr, "EDDF_N_APP"]);
    assert.deepEqual(r.avoidedStations, ["EDDF_DEL"]);
    assert.deepEqual(parse("TWR (not DEL)").avoidedStations, ["EDDF_DEL"]);
    assert.deepEqual(parse("Delivery bitte nicht").avoidedStations, ["EDDF_DEL"]);
  });

  it("bezieht eine nachgestellte Verneinung ohne Station auf das Davorstehende", () => {
    for (const text of ["Delivery no", "DEL not please", "DEL: keine Lust"]) {
      assert.deepEqual(parse(text), { preferredStations: [], avoidedStations: ["EDDF_DEL"] }, text);
    }
    assert.deepEqual(parse("TWR, DEL no"), {
      preferredStations: ["EDDF_N_TWR", "EDDF_S_TWR", "EDDM_TWR"],
      avoidedStations: ["EDDF_DEL"],
    });
  });

  it("verneint nichts, wenn die nachgestellte Angabe mehr als eine Verneinung ist", () => {
    for (const text of ["GND kein Problem", "TWR aber nicht zu lange", "EDDM not before 19z"]) {
      assert.deepEqual(parse(text).avoidedStations, [], text);
    }
    assert.deepEqual(parse("GND kein Problem").preferredStations, ["EDDF_GND", "EDDM_GND"]);
  });

  it("hält die Reihenfolge auch innerhalb eines Abschnitts", () => {
    assert.deepEqual(parse("EDDM_TWR EDDF_GND").preferredStations, ["EDDM_TWR", "EDDF_GND"]);
    assert.deepEqual(parse("ZUG DKB").preferredStations, ["EDMM_ZUG_CTR", "EDGG_DKB_CTR"]);
    assert.equal(parse("APP (gerne auch TWR)").preferredStations[0], "EDDF_N_APP");
  });

  it("verträgt Sonderzeichen in Callsigns", () => {
    const stations: WishStation[] = [
      { callsign: "EDDF_TWR(", group: "TWR", airport: "EDDF" },
      { callsign: "EDDF.TWR", group: "TWR", airport: "EDDF" },
      { callsign: "EDDF_TWR", group: "TWR", airport: "EDDF" },
    ];
    assert.deepEqual(parseWishes("EDDF TWR", stations).preferredStations, ["EDDF_TWR"]);
  });
  it("trennt auch am Satzende", () => {
    assert.deepEqual(parse("No DEL please. Tower"), {
      preferredStations: ["EDDF_N_TWR", "EDDF_S_TWR", "EDDM_TWR"],
      avoidedStations: ["EDDF_DEL"],
    });
    assert.deepEqual(parse("Tower. Delivery nicht").avoidedStations, ["EDDF_DEL"]);
  });

  it("bezieht eine nachgestellte Verneinung nur auf das zuletzt Genannte", () => {
    const r = parse("Tower - Delivery no");
    assert.deepEqual(r.preferredStations, ["EDDF_N_TWR", "EDDF_S_TWR", "EDDM_TWR"]);
    assert.deepEqual(r.avoidedStations, ["EDDF_DEL"]);
  });

  it("liest „kein Problem“ nicht als Ablehnung", () => {
    const r = parse("Tower, kein Problem mit GND");
    assert.deepEqual(r.avoidedStations, []);
    assert.ok(r.preferredStations.includes("EDDF_GND"));
  });

  it("hält das deutsche „dir“ nicht für Director", () => {
    assert.deepEqual(parse("egal, wie es dir passt"), { preferredStations: [], avoidedStations: [] });
    assert.deepEqual(parse("DIR").preferredStations, ["EDDF_N_APP"]);
  });
});

// Münchner Stationen mit Datahub-Bezeichnungen: Vorfeld und Rollkontrolle
// teilen sich _GND, Approach-Sektoren stecken im Callsign
const MUC: WishStation[] = [
  { callsign: "EDDM_DEL", group: "DEL", airport: "EDDM", abbreviation: "DMC", description: "München Delivery" },
  { callsign: "EDDM_1_GND", group: "GND", airport: "EDDM", abbreviation: "DMG1", description: "München Apron (Apron 1)" },
  { callsign: "EDDM_2_GND", group: "GND", airport: "EDDM", abbreviation: "DMG2", description: "München Apron (Apron 2)" },
  // Für die Freigabe zählt die Rollkontrolle in München zum Tower
  { callsign: "EDDM_N_GND", group: "TWR", airport: "EDDM", abbreviation: "DMGN", description: "München Ground (North)" },
  { callsign: "EDDM_S_GND", group: "TWR", airport: "EDDM", abbreviation: "DMGS", description: "München Ground (South)" },
  { callsign: "EDDM_N_TWR", group: "TWR", airport: "EDDM", abbreviation: "DMTN", description: "München Tower (North)" },
  { callsign: "EDDM_S_TWR", group: "TWR", airport: "EDDM", abbreviation: "DMTS", description: "München Tower (South)" },
  { callsign: "EDDM_ND_APP", group: "APP", airport: "EDDM", abbreviation: "DMND", description: "München Arrival (North Director)" },
  { callsign: "EDDM_NH_APP", group: "APP", airport: "EDDM", abbreviation: "DMNH", description: "München Radar (North High)" },
  { callsign: "EDDM_NL_APP", group: "APP", airport: "EDDM", abbreviation: "DMNL", description: "München Radar (North Low)" },
  { callsign: "EDDM_SH_APP", group: "APP", airport: "EDDM", abbreviation: "DMSH", description: "München Radar (South High)" },
  { callsign: "EDDM_SL_APP", group: "APP", airport: "EDDM", abbreviation: "DMSL", description: "München Radar (South Low)" },
];
const muc = (text: string) => parseWishes(text, MUC);

describe("Wünsche mit Münchner Bezeichnungen", () => {
  it("meint mit TWR nur Tower, nicht die zum Tower zählende Rollkontrolle", () => {
    assert.deepEqual(muc("TWR").preferredStations, ["EDDM_N_TWR", "EDDM_S_TWR"]);
    assert.deepEqual(muc("gerne TWR/GND :)").preferredStations, [
      "EDDM_N_TWR", "EDDM_S_TWR", "EDDM_N_GND", "EDDM_S_GND",
    ]);
  });

  it("unterscheidet Vorfeld und Rollkontrolle, auch mit Vorfeld-Nummer", () => {
    assert.deepEqual(muc("APN2>TWR>GND").preferredStations, [
      "EDDM_2_GND", "EDDM_N_TWR", "EDDM_S_TWR", "EDDM_N_GND", "EDDM_S_GND",
    ]);
    assert.deepEqual(muc("Gerne mal nen Apron").preferredStations, ["EDDM_1_GND", "EDDM_2_GND"]);
  });

  it("erkennt Sektoren aus dem Callsign und High/Low aus der Bezeichnung", () => {
    const r = muc("gerne NL/SL, ungerne High, Gerne mal ein TWR/APN");
    assert.deepEqual(r.preferredStations, [
      "EDDM_NL_APP", "EDDM_SL_APP", "EDDM_N_TWR", "EDDM_S_TWR", "EDDM_1_GND", "EDDM_2_GND",
    ]);
    assert.deepEqual(r.avoidedStations, ["EDDM_NH_APP", "EDDM_SH_APP"]);
  });

  it("hält die Reihenfolge über Sätze und „>“ hinweg", () => {
    const r = muc("Bitte kein NH. Gerne 1 Schicht NL oder ND und eine Schicht aufm Boden TWR>GND>APN");
    assert.deepEqual(r.avoidedStations, ["EDDM_NH_APP"]);
    assert.deepEqual(r.preferredStations, [
      "EDDM_NL_APP", "EDDM_ND_APP", "EDDM_N_TWR", "EDDM_S_TWR",
      "EDDM_N_GND", "EDDM_S_GND", "EDDM_1_GND", "EDDM_2_GND",
    ]);
  });

  it("lässt eine Verneinung über „/“ hinweg gelten, außer bei ausdrücklichem Wunsch", () => {
    assert.deepEqual(muc("Kein Del/ apn 1").avoidedStations, ["EDDM_DEL", "EDDM_1_GND"]);
    const r = muc("kein DEL / gerne TWR");
    assert.deepEqual(r.avoidedStations, ["EDDM_DEL"]);
    assert.deepEqual(r.preferredStations, ["EDDM_N_TWR", "EDDM_S_TWR"]);
  });

  it("zählt CO_DEL nicht als Delivery", () => {
    assert.deepEqual(muc("am liebsten kein CoDEL").avoidedStations, []);
    assert.deepEqual(muc("TWR>DEL>CO_DEL").preferredStations, ["EDDM_N_TWR", "EDDM_S_TWR", "EDDM_DEL"]);
  });

  it("liest Großgeschriebenes als Sektor, aber keine gewöhnlichen Wörter", () => {
    // „an“, „nl“ kleingeschrieben sind keine Sektoren
    assert.deepEqual(muc("gerne an den Tower").preferredStations, ["EDDM_N_TWR", "EDDM_S_TWR"]);
  });

  it("liest „Not am Mann“ nicht als Ablehnung", () => {
    const r = muc("Wenn Not am Mann auch DEL");
    assert.deepEqual(r.avoidedStations, []);
    assert.deepEqual(r.preferredStations, ["EDDM_DEL"]);
  });
});

describe("Paarwünsche aus dem Freitext", () => {
  const PEOPLE = [
    { cid: 1, name: "Giuseppe Bonvissuto" },
    { cid: 2, name: "Justin Korte" },
    { cid: 3, name: "Max Renner" },
    { cid: 4, name: "Max Bogdanski" },
    { cid: 5, name: "Jakob Wyrwich" },
  ];

  it("erkennt vollen Namen, eindeutigen Vor- oder Nachnamen", () => {
    assert.deepEqual(
      parsePartners("Bei der Bodenschicht gerne einteilen mit Justin Korte z.B TWR und GND", PEOPLE, 1),
      [2]
    );
    assert.deepEqual(parsePartners("Bitte was angrenzendes mit Giuseppe, keine Pause nötig", PEOPLE, 2), [1]);
    assert.deepEqual(parsePartners("gern neben Bogdanski", PEOPLE, 5), [4]);
  });

  it("rät nicht bei mehrdeutigen Vornamen oder Kürzeln", () => {
    assert.deepEqual(parsePartners("gerne mit Max", PEOPLE, 5), []);
    assert.deepEqual(parsePartners("Wenn MF lotst irgendwas mit MF zusammen", PEOPLE, 5), []);
  });

  it("ignoriert die eigene Person und verneinte Nennungen", () => {
    assert.deepEqual(parsePartners("Ich, Giuseppe, gerne TWR", PEOPLE, 1), []);
    assert.deepEqual(parsePartners("bitte nicht mit Justin", PEOPLE, 1), []);
  });
});
