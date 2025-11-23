import cron from 'node-cron'
import { refreshTrainingCache } from '@/lib/training/cacheService'

let isInitialized = false

/**
 * Initialize all cron jobs
 * This should be called once when the application starts
 */
export function initializeCronJobs() {
  if (isInitialized) {
    console.log('[Cron] Jobs already initialized, skipping...')
    return
  }

  console.log('[Cron] Initializing scheduled jobs...')

  // Refresh training data cache daily at 3:00 AM (UTC) by default
  // This ensures the data is fresh at least once per day
  // Can be configured via TRAINING_CACHE_REFRESH_CRON environment variable
  const cronSchedule = process.env.TRAINING_CACHE_REFRESH_CRON || '0 3 * * *'
  
  cron.schedule(cronSchedule, async () => {
    console.log('[Cron] Starting scheduled training data cache refresh...')
    try {
      const result = await refreshTrainingCache()
      console.log('[Cron] Training cache refreshed successfully:', result)
    } catch (error) {
      console.error('[Cron] Training cache refresh failed:', error)
    }
  })

  console.log('[Cron] All cron jobs initialized successfully')
  console.log(`[Cron] - Training cache refresh: Schedule = ${cronSchedule}`)
  
  isInitialized = true
}

/**
 * Get the initialization status of cron jobs
 */
export function isCronInitialized(): boolean {
  return isInitialized
}
