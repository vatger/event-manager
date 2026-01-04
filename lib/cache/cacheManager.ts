import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type CacheEntry<T> = {
  data: T;
  expires: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 1000 * 60 * 60 * 6; // 6 Stunden


// ====================================================================
// 🔹 Cache abrufen (erst Memory, dann DB)
// ====================================================================
export async function getCache<T>(key: string): Promise<T | null> {
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as T;

  const eventId = Number(key.replace("event:", ""));
  const dbCache = await prisma!.eventSignupCache.findUnique({
    where: { eventId },
  });
  if (!dbCache) return null;

  // Abgelaufen?
  if (dbCache.expiresAt && dbCache.expiresAt.getTime() < Date.now()) {
    await prisma!.eventSignupCache.delete({ where: { eventId } });
    memoryCache.delete(key);
    return null;
  }

  memoryCache.set(key, { data: dbCache.data as T, expires: Date.now() + DEFAULT_TTL });
  return dbCache.data as T;
}


// ====================================================================
// 🔹 Cache setzen / aktualisieren
// ====================================================================
export async function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL) {
  const eventId = Number(key.replace("event:", ""));
  const expiresAt = new Date(Date.now() + ttlMs);


  memoryCache.set(key, { data, expires: Date.now() + ttlMs });
}

// ====================================================================
// 🔹 Cache invalidieren (löscht RAM + DB)
// ====================================================================
export async function invalidateCache(key: string): Promise<void> {
  const eventId = Number(key.replace("event:", ""));

  // DB-Einträge löschen
  await prisma!.eventSignupCache.deleteMany({ where: { eventId } });

  // Memory-Einträge löschen (auch ähnliche Keys)
  for (const existingKey of memoryCache.keys()) {
    if (existingKey.startsWith(`event:${eventId}`)) {
      memoryCache.delete(existingKey);
      console.log(`[CACHE INVALIDATED] ${existingKey}`);
    }
  }
}

// ====================================================================
// 🔹 ALLE Caches löschen (z. B. täglicher Endorsement-Reset)
// ====================================================================
export async function invalidateAllCaches(): Promise<void> {
  await prisma!.eventSignupCache.deleteMany({});
  memoryCache.clear();
  console.log(`[CACHE CLEAR] All caches cleared`);
}
