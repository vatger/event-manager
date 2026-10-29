/**
 * Lokaler Testmodus (`npm run dev:local`, siehe docs/LOCAL_TEST_MODE.md).
 *
 * Läuft ohne jede Gegenstelle: Anmeldung als beliebiger Testnutzer statt über
 * VATGER Connect, Antworten der externen Schnittstellen aus Fixtures, Daten in
 * einer lokalen SQLite-Datenbank. Weil sich damit jeder als jeder anmelden
 * kann, greift der Modus nur zusammen mit SQLite und nie in einem
 * Produktions-Build.
 */
export function isLocalTestMode(): boolean {
  return (
    process.env.LOCAL_TEST_MODE === "true" &&
    process.env.USE_TEST_DB === "true" &&
    process.env.NODE_ENV !== "production"
  );
}
