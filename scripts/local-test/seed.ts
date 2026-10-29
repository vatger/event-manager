/**
 * Testdaten für den lokalen Testmodus (docs/LOCAL_TEST_MODE.md).
 * Läuft nach prisma/seed.ts (Berechtigungen, FIRs, Gruppen) auf einer frischen
 * SQLite-Datenbank; start.sh ruft beides auf.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createDatabaseAdapter } from "../../lib/db-adapter";
import {
  LOCAL_TEST_EDWW_LEAD_CID,
  LOCAL_TEST_ENDORSEMENTS,
  LOCAL_TEST_SOLOS,
  LOCAL_TEST_USERS,
  LOCAL_TEST_ADMIN_CID,
} from "../../lib/localTest/fixtures";

if (process.env.USE_TEST_DB !== "true") {
  console.error("Nur für die lokale SQLite-Datenbank (USE_TEST_DB=true).");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: createDatabaseAdapter() });

const DAY = 24 * 60 * 60 * 1000;

/** In `days` Tagen um `hour`:00 UTC */
function at(days: number, hour: number): Date {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

type Range = { start: string; end: string };
const full = (start: string, end: string) => ({
  available: [{ start, end }] as Range[],
  unavailable: [] as Range[],
});
const partial = (start: string, end: string, off: Range[]) => ({
  available: [{ start, end }] as Range[],
  unavailable: off,
});

async function main() {
  const firs = await prisma.fIR.findMany();
  if (firs.length === 0) throw new Error("Erst prisma/seed.ts ausführen (FIRs fehlen).");
  const firId = Object.fromEntries(firs.map((f) => [f.code, f.id]));

  if (await prisma.user.findUnique({ where: { cid: LOCAL_TEST_ADMIN_CID } })) {
    console.log("Testdaten sind schon angelegt – nichts zu tun.");
    return;
  }

  // ---- Nutzer und Rechte ----
  for (const u of LOCAL_TEST_USERS) {
    await prisma.user.create({
      data: { cid: u.cid, name: u.name, rating: u.rating, firId: firId[u.fir] },
    });
  }
  const edwwLead = await prisma.group.findFirstOrThrow({
    where: { firId: firId.EDWW, kind: "FIR_LEITUNG" },
  });
  await prisma.userGroup.create({
    data: { userCID: LOCAL_TEST_EDWW_LEAD_CID, groupId: edwwLead.id },
  });

  // ---- Trainingsdaten (statt der Training-API) ----
  const now = new Date();
  await prisma.trainingEndorsementCache.createMany({
    data: LOCAL_TEST_ENDORSEMENTS.map((e) => ({
      userCID: e.cid,
      position: e.position,
      createdAt: now,
      fetchedAt: now,
    })),
  });
  await prisma.trainingSoloCache.createMany({
    data: LOCAL_TEST_SOLOS.map((s) => ({
      userCID: s.cid,
      position: s.position,
      expiry: new Date(Date.now() + 30 * DAY),
      createdAt: now,
      fetchedAt: now,
    })),
  });
  await prisma.trainingCacheMetadata.upsert({
    where: { id: 1 },
    create: { id: 1, lastUpdated: now, forceUpdate: false },
    update: { lastUpdated: now, forceUpdate: false },
  });

  // ---- Event 1: Anmeldung geschlossen, Besetzungsplan angelegt ----
  const stations = [
    "EDDW_GND", "EDDW_TWR", "EDDW_APP",
    "EDDH_DEL", "EDDH_W_GND", "EDDH_TWR", "EDDH_APP",
    "EDWW_CTR",
  ];
  const overload = await prisma.event.create({
    data: {
      name: "Bremen & Hamburg Overload (Test)",
      description: "Testevent mit Anmeldungen und angelegtem Besetzungsplan.",
      startTime: at(14, 18),
      endTime: at(14, 22),
      airports: ["EDDW", "EDDH"],
      firCode: "EDWW",
      status: "SIGNUP_CLOSED",
      signupDeadline: new Date(Date.now() - DAY),
      staffedStations: stations,
      createdById: LOCAL_TEST_EDWW_LEAD_CID,
      responsibles: { create: [{ userCID: LOCAL_TEST_EDWW_LEAD_CID }] },
    },
  });
  await prisma.eventRoster.create({
    data: {
      eventId: overload.id,
      slotMinutes: 30,
      stations: { create: stations.map((callsign, i) => ({ callsign, sortOrder: i })) },
    },
  });

  const signups: {
    cid: number;
    availability: ReturnType<typeof full>;
    wish?: string;
    remarks?: string;
    excluded?: string[];
  }[] = [
    { cid: 1000010, availability: full("18:00", "22:00"), wish: "EDDW_TWR" },
    { cid: 1000011, availability: partial("18:00", "22:00", [{ start: "20:00", end: "22:00" }]), wish: "TWR" },
    { cid: 1000012, availability: full("18:00", "22:00"), wish: "GND oder DEL" },
    { cid: 1000013, availability: full("18:00", "22:00"), wish: "EDDH_W_GND, kein DEL" },
    { cid: 1000014, availability: partial("18:00", "22:00", [{ start: "18:00", end: "19:00" }]), wish: "egal" },
    { cid: 1000015, availability: full("18:00", "22:00"), excluded: ["EDDH"] },
    { cid: 1000016, availability: full("18:00", "22:00"), wish: "EDDH_TWR (Solo)" },
    { cid: 1000017, availability: full("18:00", "22:00"), wish: "EDDH_TWR bevorzugt" },
    { cid: 1000018, availability: partial("18:00", "22:00", [{ start: "21:00", end: "22:00" }]), wish: "TWR, nicht APP" },
    { cid: 1000019, availability: full("18:00", "22:00"), wish: "EDDH_APP" },
    { cid: 1000020, availability: full("18:00", "22:00"), wish: "lieber Bremen" },
    { cid: 1000021, availability: partial("18:00", "22:00", [{ start: "19:30", end: "20:30" }]), wish: "EDDW_APP" },
    { cid: 1000022, availability: full("18:00", "22:00"), wish: "CTR", remarks: "Gerne auch längere Schichten" },
    { cid: 1000023, availability: full("18:00", "22:00"), wish: "APP" },
    { cid: 1000024, availability: partial("18:00", "22:00", [{ start: "18:00", end: "20:00" }]), wish: "EDWW_CTR" },
    { cid: 1000025, availability: full("18:00", "22:00"), wish: "kein CTR" },
    { cid: 1000031, availability: full("18:00", "22:00"), wish: "TWR", remarks: "Gast aus EDMM" },
  ];
  for (const s of signups) {
    await prisma.eventSignup.create({
      data: {
        eventId: overload.id,
        userCID: s.cid,
        availability: s.availability,
        preferredStations: s.wish ?? "",
        remarks: s.remarks,
        excludedAirports: s.excluded ?? [],
      },
    });
  }

  // ---- Event 2: Anmeldung offen, noch kein Besetzungsplan ----
  const night = await prisma.event.create({
    data: {
      name: "Hamburg Night (Test)",
      description: "Testevent mit offener Anmeldung.",
      startTime: at(30, 19),
      endTime: at(30, 23),
      airports: ["EDDH"],
      firCode: "EDWW",
      status: "SIGNUP_OPEN",
      signupDeadline: at(23, 22),
      createdById: LOCAL_TEST_EDWW_LEAD_CID,
      responsibles: { create: [{ userCID: LOCAL_TEST_EDWW_LEAD_CID }] },
    },
  });
  for (const cid of [1000013, 1000017, 1000019, 1000022]) {
    await prisma.eventSignup.create({
      data: {
        eventId: night.id,
        userCID: cid,
        availability: full("19:00", "23:00"),
        preferredStations: "",
        excludedAirports: [],
      },
    });
  }

  // ---- Event 3: in Planung (FIR München) ----
  await prisma.event.create({
    data: {
      name: "München Local (Test)",
      description: "Testevent in Planung.",
      startTime: at(45, 17),
      endTime: at(45, 21),
      airports: ["EDDM"],
      firCode: "EDMM",
      status: "PLANNING",
    },
  });

  console.log(
    `Testdaten angelegt: ${LOCAL_TEST_USERS.length} Nutzer, 3 Events, ${signups.length + 4} Anmeldungen.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
