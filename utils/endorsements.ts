// utils/endorsements.ts
import { readFile, stat } from 'fs/promises'
import path from 'path'

let cache: Map<string, string[]> | null = null
let cacheLoadedAt = 0
const TTL_MS = 5 * 60 * 1000 // 5 Minuten
const CSV_PATH = path.join(process.cwd(), 'data', 'endorsements.csv')

async function parseCsv(text: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const lines = text.split(/\r?\n/).filter(Boolean)
  const start = lines[0]?.toLowerCase().startsWith('cid,') ? 1 : 0
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const [cidRaw, endorsementsRaw = ''] = line.split(',')
    const cid = cidRaw.trim()
    const endorsements =
      endorsementsRaw
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
    if (cid) map.set(cid, endorsements)
  }
  return map
}

async function loadMap(): Promise<Map<string, string[]>> {
  const now = Date.now()
  if (cache && now - cacheLoadedAt < TTL_MS) return cache

  // Optional: Wenn sich Datei-Änderungszeit nicht geändert hat, Cache behalten
  const text = await readFile(CSV_PATH, 'utf8')
  cache = await parseCsv(text)
  cacheLoadedAt = now
  return cache
}

export async function getEndorsementsForCid(cid: string): Promise<string[] | null> {
  const map = await loadMap()
  return map.get(String(cid)) ?? null
}
