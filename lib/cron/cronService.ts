import cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { refreshTrainingCache } from '@/lib/training/cacheService'
import { checkUpcomingEventsForReminders } from './eventReminderJob'
import { checkWeeklyOccurrenceStatus } from './weeklyNotificationsJob'
import { checkWeeklyStaffing } from './weeklyStaffingJob'
import { checkWeeklyMyVatsim } from './weeklyMyVatsimJob'

let isInitialized = false

// Job definitions with metadata
const CRON_JOBS = [
  {
    name: 'training_cache_refresh',
    displayName: 'Training Cache Aktualisierung',
    description: 'Aktualisiert den Cache für Endorsements und Ratings von der VATSIM Training API',
    envVar: 'TRAINING_CACHE_REFRESH_CRON',
    defaultSchedule: '0 3 * * *',
    handler: refreshTrainingCache,
  },
  {
    name: 'event_reminder',
    displayName: 'Event Erinnerungen',
    description: 'Sendet Erinnerungen an FIR Eventleiter für Events die in 3 Wochen beginnen',
    envVar: 'EVENT_REMINDER_CRON',
    defaultSchedule: '0 9 * * *',
    handler: checkUpcomingEventsForReminders,
  },
  {
    name: 'weekly_status_check',
    displayName: 'Weekly Status Prüfung',
    description: 'Öffnet Anmeldungen 14 Tage vorher automatisch und schließt sie bei Deadline',
    envVar: 'WEEKLY_STATUS_CHECK_CRON',
    defaultSchedule: '*/15 * * * *',
    handler: checkWeeklyOccurrenceStatus,
  },
  {
    name: 'weekly_staffing_check',
    displayName: 'Weekly Besetzungsprüfung',
    description: 'Prüft EDMM Events 24h vor Deadline ob das Roster vollständig besetzt werden kann',
    envVar: 'WEEKLY_STAFFING_CHECK_CRON',
    defaultSchedule: '0 * * * *',
    handler: checkWeeklyStaffing,
  },
  {
    name: 'weekly_myvatsim_check',
    displayName: 'myVATSIM Registrierungsprüfung',
    description: 'Prüft ob Weekly Events auf myVATSIM eingetragen sind und benachrichtigt bei fehlender Registrierung',
    envVar: 'WEEKLY_MYVATSIM_CHECK_CRON',
    defaultSchedule: '0 10 * * *',
    handler: checkWeeklyMyVatsim,
  },
] as const

/**
 * Record job execution status in database
 */
async function recordJobExecution(
  jobName: string,
  status: 'success' | 'error',
  duration: number,
  error?: Error
) {
  try {
    const errorMessage = error ? `${error.message}\n${error.stack}` : null
    
    await prisma.cronJobStatus.upsert({
      where: { jobName },
      update: {
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunDuration: duration,
        lastError: errorMessage,
        runCount: { increment: 1 },
        errorCount: status === 'error' ? { increment: 1 } : undefined,
      },
      create: {
        jobName,
        displayName: CRON_JOBS.find(j => j.name === jobName)?.displayName || jobName,
        description: CRON_JOBS.find(j => j.name === jobName)?.description || '',
        schedule: CRON_JOBS.find(j => j.name === jobName)?.defaultSchedule || '',
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunDuration: duration,
        lastError: errorMessage,
        runCount: 1,
        errorCount: status === 'error' ? 1 : 0,
      },
    })
  } catch (dbError) {
    console.error('[Cron] Failed to record job execution:', dbError)
  }
}

/**
 * Wrap a cron job handler with status tracking
 */
function wrapJobHandler(jobName: string, handler: () => Promise<any>) {
  return async () => {
    // Skip execution if the job has been disabled in the database
    const statusRecord = await prisma.cronJobStatus.findUnique({ where: { jobName } })
    if (statusRecord && !statusRecord.isActive) {
      console.log(`[Cron] ${jobName} is disabled, skipping...`)
      return
    }

    const startTime = Date.now()
    console.log(`[Cron] Starting ${jobName}...`)
    
    try {
      const result = await handler()
      const duration = Date.now() - startTime
      console.log(`[Cron] ${jobName} completed successfully in ${duration}ms:`, result)
      await recordJobExecution(jobName, 'success', duration)
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[Cron] ${jobName} failed after ${duration}ms:`, error)
      await recordJobExecution(jobName, 'error', duration, error as Error)
    }
  }
}

/**
 * Initialize job status records in database
 */
async function initializeJobStatuses() {
  try {
    for (const job of CRON_JOBS) {
      const schedule = process.env[job.envVar] || job.defaultSchedule
      
      await prisma.cronJobStatus.upsert({
        where: { jobName: job.name },
        update: {
          displayName: job.displayName,
          description: job.description,
          schedule,
          // Do not reset isActive so that manually disabled jobs stay disabled across restarts
        },
        create: {
          jobName: job.name,
          displayName: job.displayName,
          description: job.description,
          schedule,
          isActive: true,
        },
      })
    }
    console.log('[Cron] Job status records initialized')
  } catch (error) {
    console.error('[Cron] Failed to initialize job status records:', error)
  }
}

/**
 * Initialize all cron jobs
 * This should be called once when the application starts
 */
export async function initializeCronJobs() {
  if (isInitialized) {
    console.log('[Cron] Jobs already initialized, skipping...')
    return
  }

  console.log('[Cron] Initializing scheduled jobs...')

  // Initialize job status records in database
  await initializeJobStatuses()

  // Schedule all cron jobs
  for (const job of CRON_JOBS) {
    const schedule = process.env[job.envVar] || job.defaultSchedule
    cron.schedule(schedule, wrapJobHandler(job.name, job.handler))
    console.log(`[Cron] - ${job.displayName}: Schedule = ${schedule}`)
  }

  console.log('[Cron] All cron jobs initialized successfully')
  isInitialized = true
}

/**
 * Get the initialization status of cron jobs
 */
export function isCronInitialized(): boolean {
  return isInitialized
}

/**
 * Get all cron job statuses from database
 */
export async function getCronJobStatuses() {
  try {
    const statuses = await prisma.cronJobStatus.findMany({
      orderBy: { displayName: 'asc' },
    })
    return statuses
  } catch (error) {
    console.error('[Cron] Failed to get job statuses:', error)
    return []
  }
}

/**
 * Manually trigger a cron job by name
 */
export async function triggerCronJob(jobName: string): Promise<{ success: boolean; message: string; duration?: number }> {
  const job = CRON_JOBS.find(j => j.name === jobName)
  
  if (!job) {
    return { success: false, message: `Job '${jobName}' nicht gefunden` }
  }

  const startTime = Date.now()
  console.log(`[Cron] Manually triggering ${jobName}...`)
  
  try {
    await job.handler()
    const duration = Date.now() - startTime
    console.log(`[Cron] ${jobName} manually triggered successfully in ${duration}ms`)
    await recordJobExecution(jobName, 'success', duration)
    return { 
      success: true, 
      message: `Job '${job.displayName}' erfolgreich ausgeführt`,
      duration 
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Cron] ${jobName} manual trigger failed after ${duration}ms:`, error)
    await recordJobExecution(jobName, 'error', duration, error as Error)
    return { 
      success: false, 
      message: `Job fehlgeschlagen: ${(error as Error).message}`,
      duration 
    }
  }
}

/**
 * Toggle the active state of a cron job
 */
export async function toggleCronJobActive(jobName: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
  const job = CRON_JOBS.find(j => j.name === jobName)
  if (!job) {
    return { success: false, message: `Job '${jobName}' nicht gefunden` }
  }

  try {
    await prisma.cronJobStatus.update({
      where: { jobName },
      data: { isActive },
    })
    console.log(`[Cron] ${jobName} ${isActive ? 'enabled' : 'disabled'}`)
    return {
      success: true,
      message: `Job '${job.displayName}' wurde ${isActive ? 'aktiviert' : 'deaktiviert'}`,
    }
  } catch (error) {
    console.error(`[Cron] Failed to toggle ${jobName}:`, error)
    return { success: false, message: `Fehler beim Ändern des Status: ${(error as Error).message}` }
  }
}

