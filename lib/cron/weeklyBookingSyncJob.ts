import { prisma } from "@/lib/prisma";
import { syncWeeklyOccurrenceBookings } from "@/lib/bookings/eventStationBookings";
import { isBookingApiConfigured } from "@/lib/bookings/vatgerBookingClient";

/**
 * Blockt die Stationen der anstehenden Weeklys auf der VATGER Homepage.
 *
 * Der Job greift weit im Voraus: sobald eine Instanz im Zeitfenster liegt,
 * werden ihre zu besetzenden Stationen auf die Event-Kennung geblockt – lange
 * bevor ein Roster existiert. Sobald das Roster veröffentlicht ist, zieht der
 * Abgleich die Buchungen auf die eingeteilten Lotsen um.
 *
 * Beim Veröffentlichen und beim Ändern eines Rosters läuft der Abgleich
 * ohnehin sofort; dieser Job fängt die Fälle ab, in denen das nicht geklappt
 * hat – etwa weil die Homepage kurzzeitig nicht erreichbar war oder eine
 * Buchung zwischenzeitlich von Hand gelöscht wurde.
 */

/**
 * Wie weit im Voraus geblockt wird. Die Voreinstellung entspricht dem
 * Zeitraum, in dem sich Stationen auf der Homepage auch von Hand buchen
 * lassen (zwei Monate) – weiter vorne gibt es nichts zu verdrängen.
 */
const HORIZON_DAYS = Number(process.env.WEEKLY_BOOKING_SYNC_HORIZON_DAYS || 60);

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
      date: { gte: from, lte: until },
      config: { enabled: true },
    },
    select: { id: true },
    orderBy: { date: "asc" },
  });

  let synced = 0;
  let failed = 0;

  for (const occurrence of occurrences) {
    try {
      const result = await syncWeeklyOccurrenceBookings(occurrence.id);
      synced++;
      if (result.created || result.deleted || result.conflict || result.failed) {
        console.log(
          `[bookings] Weekly ${occurrence.id}: ${result.created} gebucht, ${result.deleted} entfernt, ` +
            `${result.conflict} Konflikte, ${result.failed} Fehler`,
        );
      }
      if (result.skipped) {
        console.log(`[bookings] Weekly ${occurrence.id}: ${result.skipped}`);
      }
    } catch (error) {
      failed++;
      console.error(`[bookings] Abgleich für Weekly ${occurrence.id} fehlgeschlagen:`, error);
    }
  }

  console.log(`[bookings] ${synced} von ${occurrences.length} Weeklys abgeglichen (${failed} Fehler).`);
}
