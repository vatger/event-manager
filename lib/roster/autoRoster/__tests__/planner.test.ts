import { describe, expect, it } from "vitest";
import { planRoster } from "../planner";
import type { PlannedAssignment } from "../types";
import { planningInput, signup, station, warningsForPlanned } from "./fixtures";

const AP = ["EDDM"];

function on(plan: PlannedAssignment[], stationId: number) {
  return plan.filter((a) => a.stationId === stationId).sort((a, b) => a.start - b.start);
}

/** Vier Ebenen, je drei passende Lotsen, fünf Stunden Event */
function fullyStaffedScenario() {
  const stations = [
    station(1, "EDMM_CTR"),
    station(2, "EDDM_APP"),
    station(3, "EDDM_TWR"),
    station(4, "EDDM_GND"),
  ];
  const signups = [
    signup(101, "Anna", AP, { levels: ["GND", "TWR", "APP", "CTR"] }),
    signup(102, "Ben", AP, { levels: ["GND", "TWR", "APP", "CTR"] }),
    signup(103, "Carla", AP, { levels: ["GND", "TWR", "APP", "CTR"] }),
    signup(104, "Dirk", AP, { levels: ["GND", "TWR", "APP"] }),
    signup(105, "Eva", AP, { levels: ["GND", "TWR", "APP"], preferred: "EDDM_APP" }),
    signup(106, "Finn", AP, { levels: ["GND", "TWR", "APP"] }),
    signup(107, "Greta", AP, { levels: ["GND", "TWR"] }),
    signup(108, "Hans", AP, { levels: ["GND", "TWR"] }),
    signup(109, "Ida", AP, { levels: ["GND", "TWR"] }),
    signup(110, "Jan", AP, { levels: ["GND"] }),
    signup(111, "Kim", AP, { levels: ["GND"] }),
    signup(112, "Lea", AP, { levels: ["GND"] }),
  ];
  return planningInput(stations, signups, { totalMinutes: 300 });
}

describe("planRoster", () => {
  it("besetzt bei genug Lotsen alles, ohne eine einzige Editor-Warnung", () => {
    const input = fullyStaffedScenario();
    const result = planRoster(input);

    expect(result.uncovered).toEqual([]);
    expect(result.coveredMinutes).toBe(result.openMinutes);
    expect(result.openMinutes).toBe(4 * 300);
    expect(warningsForPlanned(input, result.assignments)).toEqual([]);
    // Ohne Not keine Rest-Schnipsel
    for (const a of result.assignments) expect(a.end - a.start).toBeGreaterThanOrEqual(60);
  });

  it("lässt bei nur einer CTR-Person genau die Pausen offen", () => {
    const input = planningInput(
      [station(1, "EDMM_CTR")],
      [
        signup(201, "Solo", AP, { levels: ["GND", "TWR", "APP", "CTR"] }),
        signup(202, "Ground", AP, { levels: ["GND"] }),
      ],
      { totalMinutes: 300 }
    );
    const result = planRoster(input);

    expect(result.assignments.every((a) => a.userCID === 201)).toBe(true);
    // 2× 120 min, dazwischen und am Ende je 30 min Pause
    expect(result.coveredMinutes).toBe(240);
    expect(result.uncovered.reduce((sum, r) => sum + r.end - r.start, 0)).toBe(60);
    expect(warningsForPlanned(input, result.assignments)).toEqual([]);
  });

  it("verbraucht knappe CTR-Freigaben nicht auf Ground", () => {
    // CTR ist die erste Stunde mit einem Custom-Block belegt. Wer jetzt
    // Ground nimmt, darf das nicht die einzige CTR-Person sein – sonst bliebe
    // das Center ab der zweiten Stunde leer.
    const input = planningInput(
      [station(1, "EDMM_CTR"), station(2, "EDDM_GND")],
      [
        signup(301, "Center", AP, { levels: ["GND", "TWR", "APP", "CTR"] }),
        signup(302, "Ground", AP, { levels: ["GND"] }),
      ],
      {
        totalMinutes: 120,
        fixed: [{ stationId: 1, userCID: null, start: 0, end: 60 }],
      }
    );
    const result = planRoster(input);

    expect(result.uncovered).toEqual([]);
    expect(on(result.assignments, 1)).toEqual([
      { stationId: 1, userCID: 301, start: 60, end: 120 },
    ]);
    expect(on(result.assignments, 2)).toEqual([
      { stationId: 2, userCID: 302, start: 0, end: 120 },
    ]);
  });

  it("plant niemanden auf abgewählte Airports oder Tier-1-CTR ohne Positionsfreigabe", () => {
    const airports = ["EDDM", "EDDN"];
    const stations = [
      station(1, "EDMM_ZUG_CTR", 1, { gcapStatus: "1" }),
      station(2, "EDDM_TWR"),
      station(3, "EDDN_TWR"),
    ];
    const signups = [
      // TWR an beiden Airports, aber EDDN abgewählt
      signup(401, "NurMuc", airports, { levels: ["GND", "TWR"], excludedAirports: ["EDDN"] }),
      // CTR-Ebene, aber ohne Freigabe für die Tier-1-Position
      signup(402, "OhneT1", airports, { levels: ["GND", "TWR", "APP", "CTR"] }),
      signup(403, "MitT1", airports, {
        levels: ["GND", "TWR", "APP", "CTR"],
        endorsementExtra: { ctrEndorsements: ["EDMM_ZUG_CTR"] },
      }),
      signup(404, "Twr", airports, { levels: ["GND", "TWR"] }),
    ];
    const input = planningInput(stations, signups, { totalMinutes: 240, eventAirports: airports });
    const result = planRoster(input);

    expect(result.assignments.some((a) => a.userCID === 401 && a.stationId === 3)).toBe(false);
    expect(result.assignments.some((a) => a.userCID === 402 && a.stationId === 1)).toBe(false);
    expect(on(result.assignments, 1).every((a) => a.userCID === 403)).toBe(true);
    expect(warningsForPlanned(input, result.assignments)).toEqual([]);
  });

  it("füllt nur Lücken und schneidet bei Verfügbarkeitslücken keine Schnipsel", () => {
    const fixed = [{ stationId: 1, userCID: 501, start: 0, end: 60 }];
    const input = planningInput(
      [station(1, "EDDM_TWR")],
      [
        signup(501, "Fest", AP, { levels: ["GND", "TWR"] }),
        signup(502, "Immer", AP, { levels: ["GND", "TWR"] }),
        // 16:45–17:45 verhindert – davor und danach nur Restzeiten
        signup(503, "Lücke", AP, { levels: ["GND", "TWR"], unavailable: [["16:45", "17:45"]] }),
      ],
      { totalMinutes: 240, fixed }
    );
    const result = planRoster(input);

    expect(result.assignments.every((a) => a.start >= 60)).toBe(true);
    expect(result.uncovered).toEqual([]);
    for (const a of result.assignments) expect(a.end - a.start).toBeGreaterThanOrEqual(60);
    expect(warningsForPlanned(input, result.assignments)).toEqual([]);
  });

  it("rechnet feste Schichten in die faire Verteilung ein", () => {
    // APP ist bis 17:30 anderweitig belegt. Anna hat schon eine feste Schicht
    // auf einer anderen Station – die freie APP-Zeit geht an Carla.
    const input = planningInput(
      [station(1, "EDDM_APP")],
      [
        signup(701, "Anna", AP, { levels: ["GND", "TWR", "APP"] }),
        signup(702, "Carla", AP, { levels: ["GND", "TWR", "APP"] }),
      ],
      {
        totalMinutes: 210,
        fixed: [
          { stationId: 1, userCID: null, start: 0, end: 90 },
          { stationId: 99, userCID: 701, start: 0, end: 60 },
        ],
      }
    );
    const result = planRoster(input);
    expect(result.assignments).toEqual([{ stationId: 1, userCID: 702, start: 90, end: 210 }]);
  });

  it("plant zurückgezogene und ausgeschlossene Personen nie ein", () => {
    const input = {
      ...planningInput(
        [station(1, "EDDM_TWR")],
        [
          signup(601, "Weg", AP, { levels: ["TWR"], withdrawn: true }),
          signup(602, "Rot", AP, { levels: ["TWR"] }),
          signup(603, "Da", AP, { levels: ["TWR"] }),
        ],
        { totalMinutes: 120 }
      ),
      excludedCids: [602],
    };
    const result = planRoster(input);
    expect(result.assignments.map((a) => a.userCID)).toEqual([603]);
  });

  it("ist reproduzierbar", () => {
    const input = fullyStaffedScenario();
    expect(planRoster(input)).toEqual(planRoster(input));
  });
});
