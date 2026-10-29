/**
 * Testdaten des lokalen Testmodus – gemeinsam für das Seed-Skript
 * (scripts/local-test/seed.ts) und die nachgestellten Schnittstellen
 * (offlineFetch). Alle CIDs liegen im Bereich 1000001–1000099 und gehören
 * keinem echten Nutzer.
 */

export interface LocalTestUser {
  cid: number;
  name: string;
  rating: "S1" | "S2" | "S3" | "C1" | "C3";
  fir: "EDWW" | "EDMM" | "EDGG";
  /** Beschreibung auf der Anmeldeseite */
  role?: string;
}

/** Hauptadmin (über MAIN_ADMIN_CIDS) */
export const LOCAL_TEST_ADMIN_CID = 1000001;
/** Eventleitung der FIR Bremen */
export const LOCAL_TEST_EDWW_LEAD_CID = 1000002;

export const LOCAL_TEST_USERS: LocalTestUser[] = [
  { cid: LOCAL_TEST_ADMIN_CID, name: "Test Admin", rating: "C1", fir: "EDWW", role: "Hauptadmin" },
  { cid: LOCAL_TEST_EDWW_LEAD_CID, name: "Test Eventleitung EDWW", rating: "C1", fir: "EDWW", role: "Eventleitung EDWW" },
  { cid: 1000010, name: "Anna Becker", rating: "S1", fir: "EDWW", role: "Theory Roster" },
  { cid: 1000011, name: "Ben Schulz", rating: "S1", fir: "EDWW", role: "Theory Roster" },
  { cid: 1000012, name: "Clara Wolf", rating: "S1", fir: "EDWW" },
  { cid: 1000013, name: "David Krüger", rating: "S2", fir: "EDWW" },
  { cid: 1000014, name: "Eva Hartmann", rating: "S2", fir: "EDWW" },
  { cid: 1000015, name: "Felix Neumann", rating: "S2", fir: "EDWW" },
  { cid: 1000016, name: "Greta Lange", rating: "S2", fir: "EDWW" },
  { cid: 1000017, name: "Hannes Vogel", rating: "S3", fir: "EDWW" },
  { cid: 1000018, name: "Ida Fischer", rating: "S3", fir: "EDWW" },
  { cid: 1000019, name: "Jonas Braun", rating: "S3", fir: "EDWW" },
  { cid: 1000020, name: "Klara Zimmermann", rating: "S3", fir: "EDWW" },
  { cid: 1000021, name: "Lukas Richter", rating: "S3", fir: "EDWW" },
  { cid: 1000022, name: "Mia Koch", rating: "C1", fir: "EDWW" },
  { cid: 1000023, name: "Noah Bauer", rating: "C1", fir: "EDWW" },
  { cid: 1000024, name: "Olivia Schröder", rating: "C1", fir: "EDWW" },
  { cid: 1000025, name: "Paul Meyer", rating: "C3", fir: "EDWW" },
  { cid: 1000030, name: "Quirin Huber", rating: "S2", fir: "EDMM" },
  { cid: 1000031, name: "Rosa Maier", rating: "S3", fir: "EDMM" },
  { cid: 1000032, name: "Simon Wagner", rating: "C1", fir: "EDMM" },
];

/** Stehen auf dem Theory Roster der S1-Anmeldung */
export const LOCAL_TEST_THEORY_ROSTER = [1000010, 1000011];

/** T1-Endorsements (Hamburg ist Tier 1) und CTR-Endorsements */
export const LOCAL_TEST_ENDORSEMENTS: { cid: number; position: string }[] = [
  { cid: 1000017, position: "EDDH_TWR" },
  { cid: 1000018, position: "EDDH_TWR" },
  { cid: 1000019, position: "EDDH_APP" },
  { cid: 1000020, position: "EDDH_TWR" },
  { cid: 1000022, position: "EDDH_APP" },
  { cid: 1000023, position: "EDDH_APP" },
  { cid: 1000022, position: "EDWW_CTR" },
  { cid: 1000024, position: "EDWW_CTR" },
  { cid: 1000025, position: "EDWW_CTR" },
];

/** Solo-Freigaben (laufen 30 Tage ab Seed) */
export const LOCAL_TEST_SOLOS: { cid: number; position: string }[] = [
  { cid: 1000016, position: "EDDH_TWR" },
];
