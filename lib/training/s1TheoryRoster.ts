/**
 * Theory Roster aus der S1-Anmeldung (s1-signup, App `theoryroster`).
 *
 * Wer die S1-Theorie bestanden, das praktische Modul 5 aber noch nicht
 * abgeschlossen hat, steht dort auf dem Theorie-Roster. Solche Controller
 * haben bereits das S1-Rating, dürfen aber nur Stationen besetzen, die der
 * Datahub mit `s1_theory` kennzeichnet. Mit Abschluss von Modul 5 entfernt die
 * S1-Anmeldung den Eintrag wieder.
 *
 * Schnittstelle: GET {S1_THEORY_ROSTER_URL} mit
 * `Authorization: Token {S1_THEORY_ROSTER_TOKEN}` → `{ "entries": [cid, …] }`.
 * Achtung: Ein falscher Token liefert dort Status 200 mit `{ "error": … }` –
 * gültig ist die Antwort deshalb nur, wenn `entries` eine Liste ist.
 *
 * Die Liste ändert sich selten und wird für jede Anmeldung eines Events
 * gebraucht; sie wird deshalb kurz im Speicher gehalten. Ist die S1-Anmeldung
 * nicht erreichbar, gilt der letzte bekannte Stand. Gab es noch keinen, steht
 * vorerst niemand auf dem Roster, damit ein Ausfall dort keine Anmeldungen
 * hier blockiert – `isS1TheoryRosterKnown()` meldet das, damit niemand diesen
 * Notstand für Stunden zwischenspeichert.
 */

const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

let cached: Set<number> | null = null;
let cachedAt = 0;
/** Seit wann (in diesem Prozess) überhaupt eine Liste vorliegt */
let knownSince = 0;
/** Letzter Fehlschlag, solange noch nie eine Liste kam – bremst erneute Anfragen */
let failedAt = 0;
let inflight: Promise<Set<number>> | null = null;

const RETRY_AFTER_FAILURE_MS = 60_000;

/** Ist die Anbindung überhaupt eingerichtet? */
export function isS1TheoryRosterConfigured(): boolean {
  return !!process.env.S1_THEORY_ROSTER_URL && !!process.env.S1_THEORY_ROSTER_TOKEN;
}

async function fetchRoster(): Promise<Set<number>> {
  const url = process.env.S1_THEORY_ROSTER_URL!;
  const token = process.env.S1_THEORY_ROSTER_TOKEN!;

  const res = await fetch(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Theory Roster: HTTP ${res.status}`);

  const data = (await res.json()) as { entries?: unknown; error?: unknown };
  if (!Array.isArray(data.entries)) {
    throw new Error(
      `Theory Roster: unerwartete Antwort${data.error ? ` (${String(data.error)})` : ""}`
    );
  }
  return new Set(
    data.entries.map((e) => Number(e)).filter((cid) => Number.isInteger(cid) && cid > 0)
  );
}

/** Alle CIDs auf dem Theory Roster (zwischengespeichert) */
export async function getS1TheoryRoster(): Promise<Set<number>> {
  if (!isS1TheoryRosterConfigured()) return new Set();
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  if (!cached && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) return new Set();

  // Beim Neuberechnen einer Anmeldetabelle fragen dutzende Aufrufe zugleich –
  // sie teilen sich eine Anfrage.
  const refresh = refreshRoster();
  // Liegt schon eine Liste vor, nicht auf die Gegenseite warten (bis zu
  // REQUEST_TIMEOUT_MS je Anfrage) – sie wird im Hintergrund erneuert
  return cached ?? refresh;
}

function refreshRoster(): Promise<Set<number>> {
  if (!inflight) {
    inflight = fetchRoster()
      .then((set) => {
        if (!cached) knownSince = Date.now();
        cached = set;
        cachedAt = Date.now();
        return set;
      })
      .catch((err) => {
        console.error("[S1 THEORY] Roster nicht abrufbar, nutze letzten Stand:", err);
        // Nicht bei jedem Aufruf erneut anfragen, solange die Gegenseite hängt
        if (cached) {
          cachedAt = Date.now() - CACHE_TTL_MS + RETRY_AFTER_FAILURE_MS;
          return cached;
        }
        failedAt = Date.now();
        return new Set<number>();
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Liegt eine echte Liste vor? false, solange die S1-Anmeldung eingerichtet,
 * aber noch nie erreichbar war – Ergebnisse, die darauf beruhen, nur kurz
 * zwischenspeichern.
 */
export function isS1TheoryRosterKnown(): boolean {
  return !isS1TheoryRosterConfigured() || cached !== null;
}

/**
 * Seit wann eine echte Liste vorliegt (0 = schon immer, weil nicht
 * eingerichtet). Was davor ohne Liste berechnet wurde, kann noch eine Weile
 * zwischengespeichert sein – siehe prepareSolve.
 */
export function s1TheoryRosterKnownSince(): number {
  return isS1TheoryRosterConfigured() ? knownSince : 0;
}

/**
 * Roster laden (sofern nötig) und melden, ob eine echte Liste vorliegt – für
 * Berechnungen, die den Stand vorab festhalten. Wirft nie (getS1TheoryRoster
 * fängt Fehler selbst ab).
 */
export async function loadS1TheoryRoster(): Promise<boolean> {
  await getS1TheoryRoster();
  return isS1TheoryRosterKnown();
}

/**
 * Gilt die Einschränkung des Theory Rosters für diesen Controller?
 * Nur mit S1-Rating: Ein höheres Rating heißt, Modul 5 ist längst erledigt
 * und der Eintrag veraltet.
 */
export async function isS1TheoryOnly(cid: number, rating: number): Promise<boolean> {
  if (rating > 2) return false;
  return (await getS1TheoryRoster()).has(cid);
}
