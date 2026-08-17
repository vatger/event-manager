import { prisma } from "@/lib/prisma";
import { syncWeeklyOccurrenceBookings } from "@/lib/bookings/eventStationBookings";
import { isBookingApiConfigured } from "@/lib/bookings/vatgerBookingClient";

/**
 * Hält die Stationsbuchungen der Weeklys auf der VATGER Homepage aktuell.
 *
 * Der eigentliche Abgleich passiert bereits beim Veröffentlichen und beim
 * Ändern eines Rosters. Dieser Job fängt die Fälle ab, in denen das nicht
 * geklappt hat – etwa weil die Homepage kurzzeitig nicht erreichbar war oder
 * eine Buchung zwischenzeitlich von Hand gelöscht wurde.
 */

/** Wie weit im Voraus Weeklys abgeglichen werden. */
const HORIZON_DAYS = Number(process.env.WEEKLY_BOOKING_SYNC_HORIZON_DAYS || 14);

export async function syncUpcomingWeeklyBookings() {
  if (!isBookingApiConfigured()) {
    console.log("[bookings] Übersprungen: die VATGER Buchungsschnittstelle ist nicht konfiguriert.");
    return;
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const until = new Date(from.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const occurrences = await prisma.weeklyEventOccurrence.findMany({
    where: {
      rosterPublished: true,
      date: { gte: from, lte: until },
    },
    select: { id: true },
    orderBy: { date: "asc" },
  });

  let synced = 0;
  let failed = 0;

  for (const occurrence of occurrences) {
    try {
      const result = await syncWeeklyOccurrenceBookings(occurrence.id);
      if (result.skipped) continue;
      synced++;
      if (result.created || result.deleted || result.conflict || result.failed) {
        console.log(
          `[bookings] Weekly ${occurrence.id}: ${result.created} gebucht, ${result.deleted} entfernt, ` +
            `${result.conflict} Konflikte, ${result.failed} Fehler`,
        );
      }
    } catch (error) {
      failed++;
      console.error(`[bookings] Abgleich für Weekly ${occurrence.id} fehlgeschlagen:`, error);
    }
  }

  console.log(`[bookings] ${synced} von ${occurrences.length} Weeklys abgeglichen (${failed} Fehler).`);
}
