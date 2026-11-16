import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";

/**
 * API-Tokens für /api/v1.
 *
 * Ein Token ist "emk_" + 32 Zufallsbytes (base64url). Gespeichert wird nur
 * sein SHA-256-Hash: Wer die Datenbank liest, kann damit nichts anfangen,
 * und gesucht wird über den eindeutigen Index statt über einen
 * Zeichenvergleich. Bei 256 Bit Zufall braucht es keinen langsamen
 * Passwort-Hash.
 */

export const API_TOKEN_PREFIX = "emk_";
/** So viele Zeichen des Tokens bleiben zum Wiedererkennen sichtbar */
const VISIBLE_PREFIX = 8;
/** lastUsedAt höchstens so oft schreiben */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateApiToken(): { token: string; hash: string; prefix: string } {
  const token = API_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, hash: hashApiToken(token), prefix: token.slice(0, VISIBLE_PREFIX) };
}

export interface ApiTokenPrincipal {
  kind: "token";
  tokenId: number;
  name: string;
  /** null = alle FIRs */
  firCode: string | null;
}

/**
 * Token prüfen. null bei unbekanntem, widerrufenem oder abgelaufenem Token –
 * bewusst ohne Unterscheidung, damit niemand gültige Tokens erraten kann.
 */
export async function verifyApiToken(token: string): Promise<ApiTokenPrincipal | null> {
  if (!token.startsWith(API_TOKEN_PREFIX) || token.length < 20 || token.length > 200) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashApiToken(token) } });
  if (!row || row.revokedAt) return null;
  const now = new Date();
  if (row.expiresAt && row.expiresAt <= now) return null;

  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.apiToken
      .update({ where: { id: row.id }, data: { lastUsedAt: now } })
      .catch(() => undefined);
  }
  return { kind: "token", tokenId: row.id, name: row.name, firCode: row.firCode };
}
