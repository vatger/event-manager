/**
 * Next.js Instrumentation Hook
 * This file is used to initialize services when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeCronJobs } = await import('@/lib/cron/cronService')
    initializeCronJobs()

    // Rechtekatalog aus dem Code in die Datenbank übernehmen. Ein Fehler hier
    // darf den Start nicht verhindern – vergebene Rechte bleiben wirksam.
    try {
      const { prisma } = await import('@/lib/prisma')
      const { syncPermissionCatalog } = await import('@/lib/acl/catalogSync')
      await syncPermissionCatalog(prisma)
    } catch (error) {
      console.error('Rechtekatalog konnte nicht synchronisiert werden:', error)
    }
  }
}
