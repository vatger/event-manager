import prisma from "@/lib/prisma";

type CacheEntry<T> = {
  data: T;
  expires: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 1000 * 60 * 60 * 6; // 6 Stunden

// Hilfsfunktion, um einheitliche Keys zu erzeugen
function getEventCacheKey(eventId: number): string {
  return `event:${eventId}`;
}

// ====================================================================
// 🔹 Cache abrufen (erst Memory, dann DB)
// ====================================================================
export async function getCache<T>(key: string): Promise<T | null> {
  const cached = memoryCache.get(key);

  // 1️⃣ Memory-Cache prüfen
  if (cached) {
    if (cached.expires < Date.now()) {
      console.log(`[CACHE EXPIRED] ${key} (memory)`);
      memoryCache.delete(key);
    } else {
      console.log(`[CACHE HIT] ${key} (memory)`);
      return cached.data as T;
    }
  }

  // 2️⃣ Datenbank-Cache prüfen
  const eventId = Number(key.replace("event:", ""));
  const dbCache = await prisma.eventSignupCache.findUnique({ where: { eventId } });

  if (!dbCache) {
    console.log(`[CACHE MISS] ${key} (no DB entry)`);
    return null;
  }

  // Ablauf prüfen
  if (dbCache.expiresAt && dbCache.expiresAt.getTime() < Date.now()) {
    console.log(`[CACHE EXPIRED] ${key} (DB)`);
    await prisma.eventSignupCache.delete({ where: { eventId } });
    return null;
  }

  // 3️⃣ DB-Wert in Memory übernehmen
  memoryCache.set(key, { data: dbCache.data as T, expires: dbCache.expiresAt?.getTime() ?? Date.now() + DEFAULT_TTL });

  console.log(`[CACHE HIT] ${key} (DB → memory)`);
  return dbCache.data as T;
}

// ====================================================================
// 🔹 Cache setzen / aktualisieren
// ====================================================================
export async function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL): Promise<void> {
  const eventId = Number(key.replace("event:", ""));
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.eventSignupCache.upsert({
    where: { eventId },
    update: { data, expiresAt },
    create: { eventId, data, expiresAt },
  });

  memoryCache.set(key, { data, expires: Date.now() + ttlMs });
  console.log(`[CACHE SET] ${key} (TTL ${ttlMs / 1000 / 60} min)`);
}

// ====================================================================
// 🔹 Cache invalidieren (löscht RAM + DB)
// ====================================================================
export async function invalidateCache(key: string): Promise<void> {
  const eventId = Number(key.replace("event:", ""));

  // DB-Einträge löschen
  await prisma.eventSignupCache.deleteMany({ where: { eventId } });

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
  await prisma.eventSignupCache.deleteMany({});
  memoryCache.clear();
  console.log(`[CACHE CLEAR] All caches cleared`);
}
