import { prisma } from "@/lib/prisma";
import { eventBookingTrigger, scheduleEventBookingSync } from "@/lib/bookings/eventStationBookings";

/**
 * Die zu besetzenden Stationen eines Events – eine Liste, nicht zwei.
 *
 * Früher gab es zwei: `Event.staffedStations` aus der Eventbearbeitung, an der
 * die Blockbuchungen auf der Homepage hingen, und die Stationen des
 * Besetzungsplans, die beim Anlegen einmal übernommen und danach getrennt
 * gepflegt wurden. Kam im Editor eine Station dazu, blieb sie ungebucht; fiel
 * eine weg, blieb sie geblockt.
 *
 * Jetzt ist `Event.staffedStations` die Liste, und beide Oberflächen schreiben
 * sie: Ändert der Editor die Stationen, zieht die Eventliste nach; ändert das
 * Eventformular sie, zieht der Plan nach. Die Buchungen folgen in beiden
 * Fällen.
 */

/** Kennungen bereinigen: Großschreibung, ohne Leerzeichen und Doppelte */
export function normalizeStations(stations: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of stations) {
    const cs = s.trim().toUpperCase();
    if (cs && !seen.has(cs)) {
      seen.add(cs);
      result.push(cs);
    }
  }
  return result;
}

function parseStationList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeStations(value.filter((v): v is string => typeof v === "string"));
}

/**
 * Editor → Event: Die Stationen des Plans werden zur Eventliste.
 *
 * In der Reihenfolge des Plans, damit die öffentliche Stationsliste so
 * aussieht wie der Plan. Hat sich die Menge geändert und sind die Stationen
 * schon geblockt, gleicht der Hintergrundjob die Buchungen ab.
 */
export async function writeStationsToEvent(eventId: number, callsigns: string[]): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { status: true, staffedStations: true },
  });
  if (!event) return;

  const next = normalizeStations(callsigns);
  const before = parseStationList(event.staffedStations);
  if (before.join(",") === next.join(",")) return;

  await prisma.event.update({ where: { id: eventId }, data: { staffedStations: next } });

  const trigger = eventBookingTrigger(event.status, event.status, before, next);
  if (trigger) scheduleEventBookingSync(eventId, `roster ${trigger}`);
}

export interface StationConflict {
  callsign: string;
  shifts: number;
}

/**
 * Welche der entfallenden Stationen tragen noch Schichten?
 *
 * Das Eventformular soll keinen Plan still leeren: Eine Station mit
 * eingeplanten Schichten entfernt man im Editor, wo man sieht, was dabei
 * verschwindet.
 */
export async function stationsWithShifts(
  eventId: number,
  nextCallsigns: string[]
): Promise<StationConflict[]> {
  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    select: {
      stations: { select: { callsign: true, _count: { select: { assignments: true } } } },
    },
  });
  if (!roster) return [];
  const keep = new Set(normalizeStations(nextCallsigns));
  return roster.stations
    .filter((s) => !keep.has(s.callsign) && s._count.assignments > 0)
    .map((s) => ({ callsign: s.callsign, shifts: s._count.assignments }));
}

/**
 * Event → Editor: Die Eventliste wird auf den Plan übertragen.
 *
 * Bestehende Stationen behalten ihren Platz im Plan, neue kommen hinten
 * dazu, entfallene verschwinden. Ob dabei Schichten verloren gingen, prüft
 * der Aufrufer vorher mit `stationsWithShifts`.
 */
export async function applyStationsToRoster(eventId: number, callsigns: string[]): Promise<boolean> {
  const roster = await prisma.eventRoster.findUnique({
    where: { eventId },
    include: { stations: { orderBy: { sortOrder: "asc" } } },
  });
  if (!roster) return false;

  const wanted = normalizeStations(callsigns);
  const existing = roster.stations;
  const removed = existing.filter((s) => !wanted.includes(s.callsign));
  const added = wanted.filter((c) => !existing.some((s) => s.callsign === c));
  if (removed.length === 0 && added.length === 0) return false;

  await prisma.$transaction(async (tx) => {
    if (removed.length > 0) {
      await tx.eventRosterStation.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
    }
    let order = existing.length;
    for (const callsign of added) {
      await tx.eventRosterStation.create({
        data: { rosterId: roster.id, callsign, sortOrder: order++ },
      });
    }
  });
  return true;
}
