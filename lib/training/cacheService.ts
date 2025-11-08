import axios from 'axios'
import prisma from '@/lib/prisma'
import { EndoTrainingResponse, SoloTrainingResponse } from '../endorsements/types'
import { invalidateAllCaches } from '../cache/cacheManager'

type SoloApiItem = {
  id: number
  user_cid: number
  instructor_cid?: number
  position: string
  expiry: string
  max_days?: number
  facility?: number
  created_at: string
  updated_at: string
  position_days?: number
}

type EndorsementApiItem = {
  id: number
  user_cid: number
  instructor_cid?: number
  position: string
  facility?: number
  created_at: string
  updated_at: string
}

type FamiliarizationApiItem = {
  user__username: string
  sector__name: string
  sector__fir: string
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export async function refreshTrainingCache() {
  const token = requireEnv('TRAINING_API_TOKEN')
  const solosUrl = requireEnv('TRAINING_API_SOLOS_URL')
  const endoUrl = requireEnv('TRAINING_API_ENDORSEMENTS_URL')
  const famsUrl = requireEnv('TRAINING_API_FAMILIARIZATIONS_URL')

  const headers = { Authorization: `Token ${token}` }

  const [solosResp, endoResp, famsResp] = await Promise.all([
    axios.get<{ success?: boolean; data: SoloApiItem[] }>(solosUrl, { headers }),
    axios.get<{ success?: boolean; data: EndorsementApiItem[] }>(endoUrl, { headers }),
    axios.get<FamiliarizationApiItem[]>(famsUrl, { headers })
  ])

  const now = new Date()

  const solosData = (solosResp.data as SoloTrainingResponse).data as SoloApiItem[]
  const endoData = (endoResp.data as EndoTrainingResponse).data as EndorsementApiItem[]
  const famsData = famsResp.data as FamiliarizationApiItem[]

  const soloRows = solosData.map(s => ({
    userCID: s.user_cid,
    position: s.position,
    expiry: new Date(s.expiry),
    createdAt: new Date(s.created_at),
    updatedAt: new Date(s.updated_at),
    fetchedAt: now
  }))

  const endoRows = endoData.map(e => ({
    userCID: e.user_cid,
    position: e.position,
    createdAt: new Date(e.created_at),
    updatedAt: new Date(e.updated_at),
    fetchedAt: now
  }))

  const famRows = famsData.map(f => ({
    userCID: parseInt(f.user__username, 10),
    sectorName: f.sector__name,
    sectorFir: f.sector__fir,
    fetchedAt: now
  }))

  await prisma.$transaction([
    prisma.trainingSoloCache.deleteMany({}),
    prisma.trainingEndorsementCache.deleteMany({}),
    prisma.trainingFamiliarizationCache.deleteMany({}),
    prisma.trainingSoloCache.createMany({ data: soloRows, skipDuplicates: true }),
    prisma.trainingEndorsementCache.createMany({ data: endoRows, skipDuplicates: true }),
    prisma.trainingFamiliarizationCache.createMany({ data: famRows, skipDuplicates: true }),
    prisma.trainingCacheMetadata.upsert({
      where: { id: 1 },
      create: { id: 1, lastUpdated: now, forceUpdate: false },
      update: { lastUpdated: now, forceUpdate: false }
    })
  ])
  await invalidateAllCaches()
  return { solos: soloRows.length, endorsements: endoRows.length, familiarizations: famRows.length }
}

export async function ensureTrainingCacheFreshness(options?: { force?: boolean }) {
  const force = !!options?.force
  const meta = await prisma.trainingCacheMetadata.findFirst()
  const needsUpdate =
    force ||
    !meta ||
    meta.forceUpdate ||
    (meta.lastUpdated && Date.now() - new Date(meta.lastUpdated).getTime() > 24 * 60 * 60 * 1000)

  if (needsUpdate) {
    return refreshTrainingCache()
  }
  return null
}

export async function getCachedUserEndorsements(cid: number): Promise<string[]> {
  const rows = await prisma.trainingEndorsementCache.findMany({ where: { userCID: cid } })
  return rows.map(r => r.position)
}

export async function getCachedUserFamiliarizations(cid: number): Promise<{ familiarizations: Record<string, string[]> }> {
  const rows = await prisma.trainingFamiliarizationCache.findMany({ where: { userCID: cid } })
  const byFir: Record<string, string[]> = {}
  for (const r of rows) {
    if (!byFir[r.sectorFir]) byFir[r.sectorFir] = []
    if (!byFir[r.sectorFir].includes(r.sectorName)) byFir[r.sectorFir].push(r.sectorName)
  }
  return { familiarizations: byFir }
}

export async function getCachedUserSolos(cid: number): Promise<{ position: string; expiry: Date }[]> {
  const rows = await prisma.trainingSoloCache.findMany({ where: { userCID: cid } })
  
  const soloExpiryByPosition = Object.fromEntries(
    rows.map((r) => [r.position, r.expiry])
  );

  return rows.map(r => ({ position: r.position, expiry: r.expiry }))
}

