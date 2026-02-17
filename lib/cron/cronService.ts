import cron from 'node-cron'
import { refreshTrainingCache } from '@/lib/training/cacheService'
import { checkUpcomingEventsForReminders } from './eventReminderJob'
import { checkWeeklyOccurrenceStatus } from './weeklyNotificationsJob'
import { checkWeeklyStaffing } from './weeklyStaffingJob'
import { checkWeeklyMyVatsim } from './weeklyMyVatsimJob'

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
  const trainingCacheCron = process.env.TRAINING_CACHE_REFRESH_CRON || '0 3 * * *'
  
  cron.schedule(trainingCacheCron, async () => {
    console.log('[Cron] Starting scheduled training data cache refresh...')
    try {
      const result = await refreshTrainingCache()
      console.log('[Cron] Training cache refreshed successfully:', result)
    } catch (error) {
      console.error('[Cron] Training cache refresh failed:', error)
    }
  })

  // Check for events needing reminders daily at 9:00 AM (UTC) by default
  // Sends reminders to FIR event leaders for events starting in 3 weeks
  // where signup registration has not been opened yet
  // Can be configured via EVENT_REMINDER_CRON environment variable
  const eventReminderCron = process.env.EVENT_REMINDER_CRON || '0 9 * * *'
  
  cron.schedule(eventReminderCron, async () => {
    console.log('[Cron] Starting scheduled event reminder check...')
    try {
      const result = await checkUpcomingEventsForReminders()
      console.log('[Cron] Event reminder check completed:', result)
    } catch (error) {
      console.error('[Cron] Event reminder check failed:', error)
    }
  })

  // Check weekly occurrence status every 15 minutes by default
  // Opens signups 14 days before occurrence automatically
  // Closes signups at deadline and sends Discord notifications (EDMM)
  // Can be configured via WEEKLY_STATUS_CHECK_CRON environment variable
  const weeklyStatusCron = process.env.WEEKLY_STATUS_CHECK_CRON || '*/15 * * * *'
  
  cron.schedule(weeklyStatusCron, async () => {
    console.log('[Cron] Starting weekly occurrence status check...')
    try {
      const result = await checkWeeklyOccurrenceStatus()
      console.log('[Cron] Weekly status check completed:', result)
    } catch (error) {
      console.error('[Cron] Weekly status check failed:', error)
    }
  })

  // Check weekly staffing feasibility every hour by default
  // Checks EDMM events 24 hours before signup deadline
  // Sends Discord notification if roster cannot be completed
  // Can be configured via WEEKLY_STAFFING_CHECK_CRON environment variable
  const weeklyStaffingCron = process.env.WEEKLY_STAFFING_CHECK_CRON || '0 * * * *'
  
  cron.schedule(weeklyStaffingCron, async () => {
    console.log('[Cron] Starting weekly staffing check...')
    try {
      const result = await checkWeeklyStaffing()
      console.log('[Cron] Weekly staffing check completed:', result)
    } catch (error) {
      console.error('[Cron] Weekly staffing check failed:', error)
    }
  })

  // Check weekly events on myVATSIM daily at 10:00 AM (UTC) by default
  // Checks if upcoming weekly occurrences are registered on myVATSIM
  // Sends notifications to EDMM event team for events 2 weeks away that are not registered
  // Can be configured via WEEKLY_MYVATSIM_CHECK_CRON environment variable
  const weeklyMyVatsimCron = process.env.WEEKLY_MYVATSIM_CHECK_CRON || '0 10 * * *'
  
  cron.schedule(weeklyMyVatsimCron, async () => {
    console.log('[Cron] Starting weekly myVATSIM check...')
    try {
      const result = await checkWeeklyMyVatsim()
      console.log('[Cron] Weekly myVATSIM check completed:', result)
    } catch (error) {
      console.error('[Cron] Weekly myVATSIM check failed:', error)
    }
  })

  console.log('[Cron] All cron jobs initialized successfully')
  console.log(`[Cron] - Training cache refresh: Schedule = ${trainingCacheCron}`)
  console.log(`[Cron] - Event reminder check: Schedule = ${eventReminderCron}`)
  console.log(`[Cron] - Weekly status check: Schedule = ${weeklyStatusCron}`)
  console.log(`[Cron] - Weekly staffing check: Schedule = ${weeklyStaffingCron}`)
  console.log(`[Cron] - Weekly myVATSIM check: Schedule = ${weeklyMyVatsimCron}`)
  
  isInitialized = true
}

/**
 * Get the initialization status of cron jobs
 */
export function isCronInitialized(): boolean {
  return isInitialized
}
