/**
 * Next.js Instrumentation Hook
 * This file is used to initialize services when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Lokaler Testmodus: externe Schnittstellen vor allem anderen abklemmen
    const { isLocalTestMode } = await import('@/lib/localTest/mode')
    if (isLocalTestMode()) {
      const { installOfflineFetch } = await import('@/lib/localTest/offlineFetch')
      installOfflineFetch()
    }

    const { initializeCronJobs } = await import('@/lib/cron/cronService')
    initializeCronJobs()
  }
}
