import NodeCache from "node-cache";
// 🧠 Einfacher Memory Cache mit TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // TTL = 5 Min

/**
 * Holt Wert aus Cache oder führt Loader aus, falls nicht vorhanden
 */
export async function getOrSetCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached) return cached;

  const value = await loader();
  cache.set(key, value, ttlSeconds);
  return value;
}

/**
 * Setzt Cachewert direkt
 */
export function setCache<T>(key: string, value: T, ttlSeconds = 300) {
  cache.set(key, value, ttlSeconds);
}

/**
 * Holt Wert (ohne Loader)
 */
export function getCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

/**
 * Cache löschen
 */
export function deleteCache(key: string) {
  cache.del(key);
}

/**
 * Kompletten Cache leeren
 */
export function clearCache() {
  cache.flushAll();
  console.log("🧹 Cache cleared");
}
