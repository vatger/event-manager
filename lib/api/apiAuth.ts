import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { verifyApiToken, type ApiTokenPrincipal } from "./apiTokens";

/**
 * Wer ruft die API auf?
 *
 * Entweder ein angemeldeter Nutzer (Session-Cookie) oder ein API-Token im
 * Header `Authorization: Bearer emk_…`. Tokens werden nur im Header
 * angenommen, nie als URL-Parameter – URLs landen in Logs und Verläufen.
 *
 * Ist ein Authorization-Header gesetzt, zählt nur das Token, auch wenn
 * zusätzlich eine Session besteht: So bekommt ein Skript nie stillschweigend
 * die Rechte der Person, in deren Browser es läuft.
 */

export type ApiPrincipal = { kind: "session"; cid: number } | ApiTokenPrincipal;

export async function authenticateApiRequest(req: Request): Promise<ApiPrincipal | null> {
  const header = req.headers.get("authorization");
  if (header !== null) {
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? verifyApiToken(match[1]) : null;
  }
  const user = await getSessionUser();
  if (!user?.cid) return null;
  return { kind: "session", cid: Number(user.cid) };
}

/** Darf der Aufrufer Daten dieser FIR sehen? Tokens können auf eine FIR beschränkt sein. */
export function principalMayAccessFir(principal: ApiPrincipal, firCode: string | null): boolean {
  if (principal.kind === "session") return true;
  if (principal.firCode === null) return true;
  return !!firCode && principal.firCode.toUpperCase() === firCode.toUpperCase();
}

// --- Begrenzung der Anfragen -------------------------------------------
// Einfaches Zeitfenster im Speicher; ausreichend für eine Server-Instanz
// (wie der Realtime-Bus). Schützt vor Schleifen in Skripten, nicht vor
// verteilten Angriffen.
const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 120;
const hits = new Map<string, { windowStart: number; count: number }>();

function rateLimitKey(principal: ApiPrincipal): string {
  return principal.kind === "token" ? `t:${principal.tokenId}` : `s:${principal.cid}`;
}

function consume(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    hits.set(key, { windowStart: now, count: 1 });
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now - v.windowStart >= WINDOW_MS) hits.delete(k);
    }
    return true;
  }
  entry.count++;
  return entry.count <= LIMIT_PER_WINDOW;
}

/** Antworten der API: nie zwischenspeichern, Daten hängen am Aufrufer */
export function apiJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/**
 * Anmeldung prüfen und Anfragen begrenzen. Liefert entweder den Aufrufer
 * oder die fertige Fehlerantwort.
 */
export async function requireApiPrincipal(
  req: Request
): Promise<{ principal: ApiPrincipal } | { response: NextResponse }> {
  const principal = await authenticateApiRequest(req);
  if (!principal) {
    const res = apiJson({ error: "Unauthorized" }, 401);
    res.headers.set("WWW-Authenticate", 'Bearer realm="eventmanager"');
    return { response: res };
  }
  if (!consume(rateLimitKey(principal))) {
    const res = apiJson({ error: "Too many requests" }, 429);
    res.headers.set("Retry-After", "60");
    return { response: res };
  }
  return { principal };
}
