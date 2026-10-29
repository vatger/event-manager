import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_TEST_THEORY_ROSTER } from "./fixtures";

/**
 * Ersetzt im lokalen Testmodus `fetch` für alle externen Adressen.
 *
 * Statt jede Anbindung einzeln abzuschalten, beantwortet diese Schicht die
 * bekannten Schnittstellen aus Fixtures und weist alles andere ab – so kann
 * kein Aufruf versehentlich eine echte Gegenstelle erreichen (Benachrichtigungen,
 * Discord, Buchungen …). Anfragen an diese Instanz selbst laufen normal.
 */

const DATAHUB_STATIONS =
  "https://raw.githubusercontent.com/VATGER-Nav/datahub/production/api/stations.json";
const REQUIRED_COURSES =
  "https://raw.githubusercontent.com/VATGER-ATD/required-courses/main/courses.json";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function answer(url: URL): Promise<Response> {
  const href = url.href;

  if (href === DATAHUB_STATIONS) {
    const file = path.join(process.cwd(), "fixtures", "local-test", "stations.json");
    return new Response(await readFile(file, "utf8"), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Keine Pflichtkurse – sonst sperrte der (noch abgeschaltete) Moodle-Abgleich
  if (href === REQUIRED_COURSES) return json([]);

  const theoryRoster = process.env.S1_THEORY_ROSTER_URL;
  if (theoryRoster && href.startsWith(theoryRoster)) {
    return json({ entries: LOCAL_TEST_THEORY_ROSTER });
  }

  // Benachrichtigungen (VATGER-API) und Discord-Bot: annehmen und nur loggen
  if (url.pathname.endsWith("/send_notification")) {
    console.log(`[LOCAL TEST] Benachrichtigung unterdrückt: ${href}`);
    return json({ success: true });
  }
  const discord = process.env.DISCORD_BOT_URL;
  if (discord && href.startsWith(discord)) {
    console.log(`[LOCAL TEST] Discord-Nachricht unterdrückt: ${href}`);
    return json({ success: true });
  }

  console.warn(`[LOCAL TEST] Externe Anfrage blockiert: ${href}`);
  return json({ error: "Lokaler Testmodus: keine externen Anfragen" }, 503);
}

type Fetch = typeof globalThis.fetch;
const WRAPPED = Symbol.for("local-test.offline-fetch");

/** `fetch` mit vorgeschaltetem Filter: Lokales läuft durch, Externes wird beantwortet */
function wrap(inner: Fetch): Fetch {
  if ((inner as Fetch & { [WRAPPED]?: true })[WRAPPED]) return inner;
  const wrapped = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url = new URL(requestUrl(input));
    } catch {
      // Relative oder kaputte Adressen (z. B. "undefined/…" ohne VATGER_API)
      console.warn(`[LOCAL TEST] Ungültige Adresse blockiert: ${requestUrl(input)}`);
      return json({ error: "Lokaler Testmodus: ungültige Adresse" }, 503);
    }
    if (LOCAL_HOSTS.has(url.hostname)) return inner(input, init);
    return answer(url);
  }) as Fetch & { [WRAPPED]?: true };
  wrapped[WRAPPED] = true;
  return wrapped;
}

/**
 * Next.js setzt `fetch` im Dev-Server bei jedem Neukompilieren auf den Stand
 * vor dem Start zurück und legt seine eigene Hülle darum. Damit der Filter
 * das übersteht, wird jede neu zugewiesene Funktion ebenfalls umhüllt.
 */
export function installOfflineFetch(): void {
  const g = globalThis as typeof globalThis & { __localTestFetch?: boolean };
  if (g.__localTestFetch) return;
  g.__localTestFetch = true;

  let current = wrap(globalThis.fetch.bind(globalThis));
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (next: Fetch) => {
      current = wrap(next);
    },
  });
  console.log("[LOCAL TEST] Externe Anfragen werden lokal beantwortet bzw. blockiert");
}
