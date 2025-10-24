import { ensureTrainingCacheFreshness, refreshTrainingCache } from '@/lib/training/cacheService'

export async function GET() {
  try {
    // Force refresh when called manually or by a scheduler
    const res = await refreshTrainingCache()
    return Response.json({ success: true, ...res })
  } catch (err: any) {
    console.error('Training cache refresh failed', err)
    return new Response(JSON.stringify({ success: false, error: err?.message || 'unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
