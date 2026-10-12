/**
 * Testdaten für Besetzungsplan und Auto-Roster.
 *
 * Legt zwei Events mit Anmeldungen an, deren Freigaben über den
 * Trainings-Cache laufen – die Eignungs-Engine wertet sie also genau so aus
 * wie im Betrieb (Rating, Tier-1-Endorsements, Solos, Familiarisierungen,
 * S1-TWR, Tier-1-Center).
 *
 * - „[Test] München Overload": EDDM + EDDN + drei EDMM-Sektoren, 14 Stationen,
 *   6 Stunden, rund 55 Anmeldungen mit unterschiedlichen Freigaben,
 *   Verfügbarkeiten, Wünschen, Abwahlen und Ampel-Markierungen. Der Roster
 *   ist angelegt und enthält schon ein paar Blöcke von Hand.
 * - „[Test] Nürnberg Engpass": nur EDDN, bewusst zu wenige APP-Lotsen und
 *   noch kein Roster – hier soll die Machbarkeitsprüfung anschlagen.
 *
 * Testnutzer liegen im CID-Bereich 9000001–9000999. Ein erneuter Lauf
 * entfernt zuerst alles, was ein früherer Lauf angelegt hat.
 *
 * Aufruf: npm run seed:roster-test
 * Läuft nur mit USE_TEST_DB=true – gegen eine andere Datenbank nur mit
 * --force, damit niemand versehentlich Produktionsdaten anreichert.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../lib/db-adapter";

const force = process.argv.includes("--force");
if (process.env.USE_TEST_DB !== "true" && !force) {
  console.error(
    "❌ Abgebrochen: Die Testdaten sind für die SQLite-Testdatenbank gedacht (USE_TEST_DB=true).\n" +
      "   Gegen eine andere Datenbank nur bewusst mit: npm run seed:roster-test -- --force"
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });

const CID_MIN = 9000001;
const CID_MAX = 9000999;
const TITLE_PREFIX = "[Test]";
const FIR = { code: "EDMM", name: "FIR München" };

// ---------------------------------------------------------------------
// Zeit
// ---------------------------------------------------------------------

/** Nächster Samstag, frühestens in drei Wochen – so bleibt das Event lange „kommend" */
function upcomingSaturday(hourUtc: number, extraDays = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 21 + extraDays);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}

const hm = (start: Date, minute: number) => {
  const d = new Date(start.getTime() + minute * 60000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/**
 * Verfügbarkeit wie aus dem Anmeldeformular: Nicht verfügbare Bereiche
 * (Minuten seit Event-Start) und daraus abgeleitet die verfügbaren.
 */
function availability(start: Date, totalMinutes: number, away: [number, number][]) {
  const sorted = [...away].sort((a, b) => a[0] - b[0]);
  const available: { start: string; end: string }[] = [];
  let cursor = 0;
  for (const [from, to] of sorted) {
    if (from > cursor) available.push({ start: hm(start, cursor), end: hm(start, from) });
    cursor = Math.max(cursor, to);
  }
  if (cursor < totalMinutes) available.push({ start: hm(start, cursor), end: hm(start, totalMinutes) });
  return {
    available,
    unavailable: sorted.map(([from, to]) => ({ start: hm(start, from), end: hm(start, to) })),
  };
}

/** Typische Muster für ein 6-Stunden-Event (Minuten seit Start) */
const PATTERNS: { name: string; away: [number, number][] }[] = [
  { name: "ganzer Abend", away: [] },
  { name: "ganzer Abend", away: [] },
  { name: "ganzer Abend", away: [] },
  { name: "kommt später", away: [[0, 60]] },
  { name: "geht früher", away: [[300, 360]] },
  { name: "erste Hälfte", away: [[210, 360]] },
  { name: "zweite Hälfte", away: [[0, 150]] },
  { name: "Pause in der Mitte", away: [[150, 210]] },
  { name: "nur Kernzeit", away: [[0, 90], [270, 360]] },
];

// Reproduzierbarer Zufall – jeder Lauf ergibt dieselben Testdaten
let seed = 20261009;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------

interface Profile {
  /** Kurzform im Namen, damit man im Editor sofort sieht, wer was darf */
  tag: string;
  rating: "S1" | "S2" | "S3" | "C1" | "C3";
  count: number;
  endorsements?: string[];
  solos?: string[];
  fams?: string[];
  /**
   * Mögliche Wunschstationen – Freitext, wie er in Anmeldungen wirklich steht.
   * Der Auto-Roster deutet ihn (siehe lib/roster/stationWishes.ts).
   */
  wishes?: string[];
}

const T1_FULL = ["EDDM_GNDDEL", "EDDM_TWR", "EDDM_APP"];

const PROFILES: Profile[] = [
  // Center
  {
    tag: "C1 ZUG",
    rating: "C1",
    count: 3,
    endorsements: ["EDMM_ZUG_CTR", ...T1_FULL],
    fams: ["STA", "WLD", "HOF"],
    wishes: ["ZUG", "Zugspitze bitte", "Center, gern ZUG", "EDMM_ZUG_CTR"],
  },
  {
    tag: "C1 WLD+STA",
    rating: "C1",
    count: 4,
    endorsements: T1_FULL,
    fams: ["WLD", "STA"],
    wishes: ["Walda oder Starnberg", "CTR", "Center, sonst Radar", "WLD"],
  },
  // CTR nur mit einer Familiarisierung, an EDDM nur APP (kein GNDDEL/TWR)
  { tag: "C1 WLD", rating: "C1", count: 2, endorsements: ["EDDM_APP"], fams: ["WLD"] },
  // C1 ohne Familiarisierung: Center gesperrt, Rest wie S3
  { tag: "C1 ohne FAM", rating: "C1", count: 1, endorsements: T1_FULL },
  // Trainee mit Center-Solo: darf STA, sonst nichts im Center
  { tag: "S3 Solo STA", rating: "S3", count: 1, endorsements: T1_FULL, solos: ["EDMM_STA_CTR"] },
  // Mentor (bekommt im Plan einen „Mentor"-Block)
  { tag: "C3 Mentor", rating: "C3", count: 1, endorsements: ["EDMM_ZUG_CTR", ...T1_FULL], fams: ["STA", "WLD", "HOF"] },

  // Approach
  {
    tag: "S3 EDDM",
    rating: "S3",
    count: 7,
    endorsements: T1_FULL,
    wishes: ["Radar", "MUC APP", "Director", "1. APP 2. TWR", "Tower Nord", "APP, kein DEL"],
  },
  // APP-Freigabe ohne TWR-Endorsement: APP heißt nicht automatisch TWR
  { tag: "S3 nur APP", rating: "S3", count: 1, endorsements: ["EDDM_GNDDEL", "EDDM_APP"] },
  // Ohne Tier-1-Endorsements: an EDDM gar nichts, an EDDN alles bis APP
  { tag: "S3 EDDN", rating: "S3", count: 4, wishes: ["NUE APP", "Nürnberg Arrival"] },
  // S2 mit APP-Solo
  { tag: "S2 Solo APP", rating: "S2", count: 1, endorsements: ["EDDM_GNDDEL", "EDDM_TWR"], solos: ["EDDM_APP"] },

  // Tower
  {
    tag: "S2 EDDM",
    rating: "S2",
    count: 8,
    endorsements: ["EDDM_GNDDEL", "EDDM_TWR"],
    wishes: ["Tower", "TWR N/S", "MUC Tower, kein DEL", "Tower Süd"],
  },
  {
    tag: "S2 GNDDEL",
    rating: "S2",
    count: 3,
    endorsements: ["EDDM_GNDDEL"],
    wishes: ["ne Runde APN", "Apron 1 oder 2"],
  },
  { tag: "S2 EDDN", rating: "S2", count: 4, wishes: ["Nürnberg Tower", "EDDN_TWR"] },

  // Ground / Delivery
  {
    tag: "S1 EDDM",
    rating: "S1",
    count: 9,
    endorsements: ["EDDM_GNDDEL"],
    wishes: ["ne Runde APN", "Apron", "Delivery", "GND, kein DEL", "Vorfeld 2", "kein DEL"],
  },
  // S1 an EDDN: GND und – dank S1-TWR – auch EDDN_TWR
  { tag: "S1 EDDN", rating: "S1", count: 5, wishes: ["NUE TWR", "Nürnberg Ground"] },
  // S1 mit Tower-Solo an EDDM
  { tag: "S1 Solo TWR", rating: "S1", count: 1, endorsements: ["EDDM_GNDDEL"], solos: ["EDDM_TWR"] },
];

const FIRST_NAMES = [
  "Anna", "Ben", "Clara", "David", "Emma", "Felix", "Greta", "Hannes", "Ida", "Jonas",
  "Klara", "Lukas", "Mia", "Noah", "Olivia", "Paul", "Quirin", "Rosa", "Simon", "Theresa",
  "Uwe", "Vera", "Wolfgang", "Xenia", "Yannick", "Zoe", "Anton", "Berta", "Carl", "Dora",
  "Emil", "Frieda", "Georg", "Hanna", "Igor", "Jana", "Karl", "Lena", "Max", "Nora",
  "Oskar", "Pia", "Rudi", "Sophie", "Tim", "Ulla", "Valentin", "Wilma", "Xaver", "Yvonne",
  "Zacharias", "Alma", "Bruno", "Cora", "Dieter", "Elsa", "Fritz", "Gisela", "Heinz", "Inge",
];

const REMARKS = [
  "Kann bei Bedarf länger bleiben",
  "Bitte möglichst nicht auf Delivery",
  "Erstes großes Event – gern mit erfahrenen Nachbarn",
  "Komme direkt von der Arbeit, evtl. 10 min später",
  "Lieber eine längere als zwei kurze Schichten",
];

// ---------------------------------------------------------------------
// Aufräumen
// ---------------------------------------------------------------------

async function cleanup() {
  const events = await prisma.event.findMany({
    where: { name: { startsWith: TITLE_PREFIX } },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);
  const testUsers = { gte: CID_MIN, lte: CID_MAX };

  if (eventIds.length > 0) {
    await prisma.eventRoster.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.eventSignupCache.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.notification.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.eventSignup.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  }

  await prisma.notification.deleteMany({ where: { userCID: testUsers } });
  await prisma.eventSignup.deleteMany({ where: { userCID: testUsers } });
  await prisma.weeklyEventSignup.deleteMany({ where: { userCID: testUsers } });
  await prisma.trainingEndorsementCache.deleteMany({ where: { userCID: testUsers } });
  await prisma.trainingSoloCache.deleteMany({ where: { userCID: testUsers } });
  await prisma.trainingFamiliarizationCache.deleteMany({ where: { userCID: testUsers } });
  await prisma.user.deleteMany({ where: { cid: testUsers } });

  if (eventIds.length > 0) {
    console.log(`🧹 Vorherige Testdaten entfernt (${eventIds.length} Events)`);
  }
}

// ---------------------------------------------------------------------
// Anlegen
// ---------------------------------------------------------------------

interface TestController {
  cid: number;
  name: string;
  profile: Profile;
}

async function createControllers(firId: number): Promise<TestController[]> {
  const now = new Date();
  const soloExpiry = new Date(Date.now() + 45 * 24 * 3600 * 1000);
  const controllers: TestController[] = [];
  let cid = CID_MIN;
  let nameIdx = 0;

  for (const profile of PROFILES) {
    for (let i = 0; i < profile.count; i++) {
      const first = FIRST_NAMES[nameIdx++ % FIRST_NAMES.length];
      const name = `${first} [${profile.tag}]`;
      await prisma.user.create({ data: { cid, name, rating: profile.rating, firId } });

      for (const position of profile.endorsements ?? []) {
        await prisma.trainingEndorsementCache.create({
          data: { userCID: cid, position, createdAt: now },
        });
      }
      for (const position of profile.solos ?? []) {
        await prisma.trainingSoloCache.create({
          data: { userCID: cid, position, expiry: soloExpiry, createdAt: now },
        });
      }
      for (const sectorName of profile.fams ?? []) {
        await prisma.trainingFamiliarizationCache.create({
          data: { userCID: cid, sectorName, sectorFir: FIR.code },
        });
      }

      controllers.push({ cid, name, profile });
      cid++;
    }
  }
  return controllers;
}

async function createOverloadEvent(controllers: TestController[]) {
  const start = upcomingSaturday(16);
  const totalMinutes = 360;
  const end = new Date(start.getTime() + totalMinutes * 60000);
  const stations = [
    "EDMM_ZUG_CTR",
    "EDMM_WLD_CTR",
    "EDMM_STA_CTR",
    "EDDM_NH_APP",
    "EDDM_SH_APP",
    "EDDM_ND_APP",
    "EDDM_N_TWR",
    "EDDM_S_TWR",
    "EDDM_1_GND",
    "EDDM_2_GND",
    "EDDM_DEL",
    "EDDN_D_APP",
    "EDDN_TWR",
    "EDDN_GND",
  ];

  const event = await prisma.event.create({
    data: {
      name: `${TITLE_PREFIX} München Overload`,
      description:
        "Testevent für Besetzungsplan und Auto-Roster: EDDM (Tier 1), EDDN (S1-TWR) und drei Center-Sektoren.",
      startTime: start,
      endTime: end,
      airports: ["EDDM", "EDDN"],
      staffedStations: stations,
      signupDeadline: new Date(start.getTime() - 7 * 24 * 3600 * 1000),
      signupSlotMinutes: 30,
      status: "SIGNUP_CLOSED",
      firCode: FIR.code,
    },
  });

  // Anmeldungen mit Sonderfällen, verteilt über alle Profile
  const special = (i: number) => ({
    withdrawn: i === 5 || i === 22 || i === 40,
    late: i === 12 || i === 33,
    excludeEddn: i === 8 || i === 18 || i === 27 || i === 45,
    excludeEddm: i === 31 || i === 50,
  });
  let i = 0;
  for (const c of controllers) {
    const s = special(i);
    const pattern = PATTERNS[i % PATTERNS.length];
    const wish = c.profile.wishes && rnd() < 0.7 ? pick(c.profile.wishes) : "";
    const excluded = s.excludeEddn ? ["EDDN"] : s.excludeEddm ? ["EDDM"] : null;
    await prisma.eventSignup.create({
      data: {
        eventId: event.id,
        userCID: c.cid,
        availability: availability(start, totalMinutes, pattern.away),
        preferredStations: wish,
        remarks: rnd() < 0.2 ? pick(REMARKS) : null,
        excludedAirports: excluded ?? undefined,
        deletedAt: s.withdrawn ? new Date() : null,
        deletedBy: s.withdrawn ? c.cid : null,
        signedUpAfterDeadline: s.late,
      },
    });
    i++;
  }

  // Roster mit Stationen und ein paar Blöcken von Hand
  const roster = await prisma.eventRoster.create({ data: { eventId: event.id, slotMinutes: 30 } });
  const stationId = new Map<string, number>();
  for (const [idx, callsign] of stations.entries()) {
    const st = await prisma.eventRosterStation.create({
      data: { rosterId: roster.id, callsign, sortOrder: idx },
    });
    stationId.set(callsign, st.id);
  }
  const at = (minute: number) => new Date(start.getTime() + minute * 60000);
  const byTag = (tag: string) => controllers.filter((c) => c.profile.tag === tag);
  const zug = byTag("C1 ZUG")[0];
  const mentor = byTag("C3 Mentor")[0];

  await prisma.eventRosterAssignment.createMany({
    data: [
      // Fest eingeplant: Zugspitze die ersten zwei Stunden
      {
        rosterId: roster.id,
        stationId: stationId.get("EDMM_ZUG_CTR")!,
        type: "controller",
        userCID: zug.cid,
        startTime: at(0),
        endTime: at(120),
      },
      // Director anfangs zusammengelegt
      {
        rosterId: roster.id,
        stationId: stationId.get("EDDM_ND_APP")!,
        type: "custom",
        label: "Combined (NH)",
        color: "slate",
        startTime: at(0),
        endTime: at(60),
      },
      // Mentor-Block: in der Zeit ist die Person gebunden
      {
        rosterId: roster.id,
        stationId: null,
        type: "personal",
        userCID: mentor.cid,
        label: "Mentor",
        startTime: at(120),
        endTime: at(240),
      },
    ],
  });

  // Ampel-Markierungen
  const flags: [TestController, "green" | "amber" | "red", string][] = [
    [byTag("S1 EDDM")[1], "red", ""],
    [byTag("S2 EDDN")[0], "red", ""],
    [byTag("S3 EDDM")[2], "amber", "Hat um kurze Schichten gebeten"],
    [byTag("S2 EDDM")[4], "amber", ""],
    [byTag("C1 WLD+STA")[0], "green", "Fest für Center eingeplant"],
    [byTag("S3 EDDM")[0], "green", ""],
    [byTag("S1 EDDM")[0], "green", ""],
  ];
  for (const [c, flag, note] of flags) {
    await prisma.eventRosterNote.create({
      data: { rosterId: roster.id, userCID: c.cid, note, flag, authorCID: null },
    });
  }

  return event;
}

async function createShortageEvent(controllers: TestController[]) {
  const start = upcomingSaturday(17, 7);
  const totalMinutes = 240;
  const end = new Date(start.getTime() + totalMinutes * 60000);

  const event = await prisma.event.create({
    data: {
      name: `${TITLE_PREFIX} Nürnberg Engpass`,
      description:
        "Testevent für die Machbarkeitsprüfung: zwei Approach-Stationen, aber kaum Approach-Lotsen.",
      startTime: start,
      endTime: end,
      airports: ["EDDN"],
      staffedStations: ["EDDN_FRK_APP", "EDDN_D_APP", "EDDN_TWR", "EDDN_GND"],
      signupSlotMinutes: 30,
      status: "SIGNUP_OPEN",
      firCode: FIR.code,
    },
  });

  // Zwei APP-fähige, einer davon nur die erste Hälfte; dazu Tower und Ground
  const byTag = (tag: string) => controllers.filter((c) => c.profile.tag === tag);
  const signups: [TestController, [number, number][]][] = [
    [byTag("S3 EDDN")[0], []],
    [byTag("S3 EDDN")[1], [[120, 240]]],
    [byTag("S2 EDDN")[1], []],
    [byTag("S2 EDDN")[2], [[0, 60]]],
    [byTag("S1 EDDN")[0], []],
    [byTag("S1 EDDN")[1], [[180, 240]]],
    [byTag("S1 EDDN")[2], []],
  ];
  for (const [c, away] of signups) {
    await prisma.eventSignup.create({
      data: {
        eventId: event.id,
        userCID: c.cid,
        availability: availability(start, totalMinutes, away),
        preferredStations: "",
      },
    });
  }
  return event;
}

// ---------------------------------------------------------------------

async function main() {
  console.log("🌱 Testdaten für Besetzungsplan und Auto-Roster …");
  await cleanup();

  const fir = await prisma.fIR.upsert({
    where: { code: FIR.code },
    update: {},
    create: FIR,
  });

  const controllers = await createControllers(fir.id);
  const overload = await createOverloadEvent(controllers);
  const shortage = await createShortageEvent(controllers);

  console.log(`\n✅ ${controllers.length} Testlotsen (CID ${CID_MIN}–${CID_MIN + controllers.length - 1})`);
  for (const p of PROFILES) console.log(`   ${String(p.count).padStart(2)}× ${p.tag}`);
  console.log(`\n📅 ${overload.name}: /admin/events/${overload.id}/roster`);
  console.log(`📅 ${shortage.name}: /admin/events/${shortage.id}/signups`);
  console.log(
    "\nZugriff: die eigene CID in MAIN_ADMIN_CIDS eintragen – oder per Basis-Seed als EDMM-Eventleitung."
  );
}

main()
  .catch((e) => {
    console.error("❌ Fehler beim Anlegen der Testdaten:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
