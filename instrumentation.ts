/**
 * Next.js Instrumentation Hook
 * This file is used to initialize services when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeCronJobs } = await import('@/lib/cron/cronService')
    initializeCronJobs()
  }
}
