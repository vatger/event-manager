/**
 * Blockt die Stationen eines Events als "vatger Event Buchung" auf der
 * VATGER Homepage.
 *
 * Zwei Wege führen hier her:
 *
 *  - **Weeklys**: die zu besetzenden Stationen werden automatisch und weit im
 *    Voraus auf die Event-Kennung (`VATGER_EVENT_BOOKING_CID`) geblockt. Ist
 *    das Roster veröffentlicht, wandert jede eingeteilte Station auf die
 *    VATSIM ID des eingeteilten Lotsen; alles Übrige bleibt geblockt.
 *  - **Unregelmäßige Events**: das Eventteam blockt die als "zu besetzen"
 *    eingetragenen Stationen per Knopfdruck. Da hier zum Zeitpunkt des
 *    Blockens noch keine Einteilung feststeht, laufen diese Buchungen auf die
 *    in `VATGER_EVENT_BOOKING_CID` hinterlegte Event-Kennung.
 *
 * Grundlage ist immer eine Referenz (`eventmanager:event:<id>` bzw.
 * `eventmanager:weekly:<occurrenceId>`). Die Homepage speichert sie an der
 * Buchung, wodurch der Eventmanager ausschließlich seine eigenen Buchungen
 * wiederfindet und aufräumt.
 */

import { prisma } from "@/lib/prisma";
import {
  createEventBookings,
  deleteEventBookings,
  isBookingApiConfigured,
  listEventBookings,
  VatgerBooking,
  VatgerBookingRequest,
  VatgerBookingResult,
  VatgerDeletedBooking,
} from "./vatgerBookingClient";

const REFERENCE_PREFIX = "eventmanager";

/** Referenz eines unregelmäßigen Events. */
export function eventBookingReference(eventId: number): string {
  return `${REFERENCE_PREFIX}:event:${eventId}`;
}

/** Referenz einer Weekly-Instanz. */
export function weeklyBookingReference(occurrenceId: number): string {
  return `${REFERENCE_PREFIX}:weekly:${occurrenceId}`;
}

/** Eine Station, die für einen Zeitraum geblockt werden soll. */
export interface DesiredBooking {
  callsign: string;
  cid: number;
  start: Date;
  end: Date;
}

export interface BookingSyncResult {
  reference: string;
  /** Ist die Homepage-Schnittstelle überhaupt konfiguriert? */
  configured: boolean;
  /** Grund, weshalb nichts zu tun war (falls zutreffend). */
  skipped?: string;
  created: number;
  existing: number;
  conflict: number;
  failed: number;
  deleted: number;
  results: VatgerBookingResult[];
  /** Buchungen, die nicht mehr zur Planung passen und entfernt wurden. */
  removed: VatgerDeletedBooking[];
}

function emptyResult(reference: string, overrides: Partial<BookingSyncResult> = {}): BookingSyncResult {
  return {
    reference,
    configured: true,
    created: 0,
    existing: 0,
    conflict: 0,
    failed: 0,
    deleted: 0,
    results: [],
    removed: [],
    ...overrides,
  };
}

/** Zeitstempel auf volle Minuten in UTC – die Homepage rechnet genauso. */
function toApiTimestamp(date: Date): string {
  const rounded = new Date(date);
  rounded.setUTCSeconds(0, 0);
  return rounded.toISOString();
}

function sameBooking(existing: VatgerBooking, desired: DesiredBooking): boolean {
  return (
    (existing.callsign ?? "").toUpperCase() === desired.callsign.toUpperCase() &&
    existing.cid === desired.cid &&
    new Date(existing.start).getTime() === new Date(toApiTimestamp(desired.start)).getTime() &&
    new Date(existing.end).getTime() === new Date(toApiTimestamp(desired.end)).getTime()
  );
}

/**
 * Gleicht die Buchungen einer Referenz mit dem gewünschten Stand ab:
 * überzählige Buchungen werden entfernt, fehlende angelegt. Ein leerer
 * Wunschstand gibt damit alle Stationen wieder frei.
 */
export async function syncBookings(reference: string, desired: DesiredBooking[]): Promise<BookingSyncResult> {
  if (!isBookingApiConfigured()) {
    return emptyResult(reference, {
      configured: false,
      skipped: "Die VATGER Buchungsschnittstelle ist nicht konfiguriert.",
    });
  }

  const current = await listEventBookings(reference);

  // Erst aufräumen, dann buchen: sonst blockiert eine veraltete Buchung die
  // neue Buchung derselben Station.
  const obsolete = current.filter((booking) => !desired.some((d) => sameBooking(booking, d)));
  let removed: VatgerDeletedBooking[] = [];
  if (obsolete.length > 0) {
    const response = await deleteEventBookings({ bookingIds: obsolete.map((b) => b.booking_id) });
    removed = response.results;
  }

  const missing = desired.filter((d) => !current.some((booking) => sameBooking(booking, d)));
  const result = emptyResult(reference, {
    deleted: removed.filter((r) => r.status === "deleted").length,
    existing: desired.length - missing.length,
    removed,
  });

  if (missing.length === 0) {
    return result;
  }

  const payload: VatgerBookingRequest[] = missing.map((d) => ({
    callsign: d.callsign.toUpperCase(),
    cid: d.cid,
    start: toApiTimestamp(d.start),
    end: toApiTimestamp(d.end),
  }));

  const response = await createEventBookings(reference, payload);

  return {
    ...result,
    created: response.created,
    existing: result.existing + response.existing,
    conflict: response.conflict,
    failed: response.failed,
    results: response.results,
  };
}

/** Gibt alle Buchungen einer Referenz wieder frei. */
export async function releaseBookings(reference: string): Promise<BookingSyncResult> {
  return syncBookings(reference, []);
}

/** Listet die aktuell zu einer Referenz bestehenden Buchungen auf. */
export async function getBookings(reference: string): Promise<VatgerBooking[]> {
  if (!isBookingApiConfigured()) return [];
  return listEventBookings(reference);
}

/**
 * Rechnet eine Ortszeit (Europe/Berlin) in einen UTC-Zeitpunkt um.
 *
 * Weeklys speichern das Datum als UTC-Mitternacht und die Uhrzeiten als
 * "HH:mm" in Ortszeit; für die Buchung braucht die Homepage UTC.
 */
function berlinWallClockToUtc(year: number, month: number, day: number, hours: number, minutes: number): Date {
  const naiveUtc = Date.UTC(year, month, day, hours, minutes);
  // Zwei Durchläufe, damit auch die Zeitumstellung sauber getroffen wird.
  let result = naiveUtc - berlinOffsetMinutes(new Date(naiveUtc)) * 60_000;
  result = naiveUtc - berlinOffsetMinutes(new Date(result)) * 60_000;
  return new Date(result);
}

function berlinOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = value("hour") % 24; // Intl liefert je nach Umgebung "24" für Mitternacht
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));

  return Math.round((asUtc - instant.getTime()) / 60_000);
}

function parseTimeOfDay(value: string | null | undefined, fallbackHours: number): [number, number] {
  if (!value) return [fallbackHours, 0];
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return [fallbackHours, 0];
  return [hours, minutes];
}

function parseStations(value: unknown): string[] {
  if (!value) return [];
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Start- und Endzeitpunkt einer Weekly-Instanz in UTC. */
export function weeklyOccurrenceTimeframe(
  date: Date,
  startTime: string | null,
  endTime: string | null,
): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const [startHours, startMinutes] = parseTimeOfDay(startTime, 18);
  const [endHours, endMinutes] = parseTimeOfDay(endTime, 22);

  const start = berlinWallClockToUtc(year, month, day, startHours, startMinutes);
  let end = berlinWallClockToUtc(year, month, day, endHours, endMinutes);
  // Events über Mitternacht enden am Folgetag.
  if (end.getTime() <= start.getTime()) {
    end = berlinWallClockToUtc(year, month, day + 1, endHours, endMinutes);
  }

  return { start, end };
}

/**
 * Die VATSIM ID, auf die geblockt wird, solange keine Einteilung feststeht.
 */
export function getBlockingCid(): number | null {
  const cid = Number(process.env.VATGER_EVENT_BOOKING_CID);
  return Number.isInteger(cid) && cid > 0 ? cid : null;
}

/**
 * Synchronisiert die Buchungen einer Weekly-Instanz.
 *
 * Die Stationen werden bereits geblockt, sobald die Instanz feststeht – also
 * lange vor dem Roster – und laufen bis dahin auf die Event-Kennung. Ist das
 * Roster veröffentlicht, wandert jede eingeteilte Station auf die VATSIM ID
 * des eingeteilten Lotsen; Stationen ohne Einteilung bleiben auf der
 * Event-Kennung geblockt.
 *
 * Instanzen eines deaktivierten Weeklys werden wieder freigegeben, Instanzen
 * in der Vergangenheit nicht mehr angefasst.
 */
export async function syncWeeklyOccurrenceBookings(occurrenceId: number): Promise<BookingSyncResult> {
  const reference = weeklyBookingReference(occurrenceId);

  const occurrence = await prisma.weeklyEventOccurrence.findUnique({
    where: { id: occurrenceId },
    include: { config: true, rosters: true },
  });

  if (!occurrence) {
    return emptyResult(reference, { skipped: "Weekly-Instanz nicht gefunden." });
  }

  const { start, end } = weeklyOccurrenceTimeframe(
    occurrence.date,
    occurrence.config.startTime,
    occurrence.config.endTime,
  );

  if (end.getTime() <= Date.now()) {
    return emptyResult(reference, { skipped: "Die Weekly-Instanz liegt in der Vergangenheit." });
  }

  if (!occurrence.config.enabled) {
    return releaseBookings(reference);
  }

  // Sobald das Roster veröffentlicht ist, gilt die Einteilung.
  const assignments = new Map<string, number>();
  if (occurrence.rosterPublished) {
    for (const entry of occurrence.rosters) {
      if (entry.station && entry.userCID) {
        assignments.set(entry.station.trim().toUpperCase(), entry.userCID);
      }
    }
  }

  const blockingCid = getBlockingCid();
  const callsigns = new Set([...parseStations(occurrence.config.staffedStations), ...assignments.keys()]);

  if (callsigns.size === 0) {
    return releaseBookings(reference);
  }

  const desired: DesiredBooking[] = [];
  const unblockable: string[] = [];

  for (const callsign of callsigns) {
    const cid = assignments.get(callsign) ?? blockingCid;
    if (!cid) {
      unblockable.push(callsign);
      continue;
    }
    desired.push({ callsign, cid, start, end });
  }

  if (desired.length === 0) {
    return emptyResult(reference, {
      skipped: "Es ist keine VATSIM ID für Blockbuchungen hinterlegt (VATGER_EVENT_BOOKING_CID).",
    });
  }

  const result = await syncBookings(reference, desired);

  if (unblockable.length > 0) {
    return {
      ...result,
      skipped: `Ohne VATGER_EVENT_BOOKING_CID nicht geblockt: ${unblockable.join(", ")}`,
    };
  }

  return result;
}

/** Gibt die Stationen einer Weekly-Instanz wieder frei. */
export async function releaseWeeklyOccurrenceBookings(occurrenceId: number): Promise<BookingSyncResult> {
  return releaseBookings(weeklyBookingReference(occurrenceId));
}

/**
 * Gibt die Stationen aller Instanzen eines Weeklys wieder frei.
 *
 * Wird beim Löschen einer Weekly-Konfiguration verwendet und muss dort vor
 * dem Löschen laufen, weil die Instanzen mit der Konfiguration verschwinden.
 */
export async function releaseWeeklyConfigBookings(configId: number): Promise<number> {
  if (!isBookingApiConfigured()) return 0;

  // Vergangene Instanzen sind ohnehin abgelaufen und werden übersprungen.
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const occurrences = await prisma.weeklyEventOccurrence.findMany({
    where: { configId, date: { gte: from } },
    select: { id: true },
  });

  let released = 0;
  for (const occurrence of occurrences) {
    try {
      const result = await releaseWeeklyOccurrenceBookings(occurrence.id);
      released += result.deleted;
    } catch (error) {
      console.error(`[bookings] Freigabe für Weekly ${occurrence.id} fehlgeschlagen:`, error);
    }
  }

  return released;
}

/**
 * Stößt den Abgleich einer Weekly-Instanz im Hintergrund an.
 *
 * Wird aus den Roster-Routen heraus aufgerufen: das Speichern einer
 * Einteilung soll nicht daran scheitern, dass die Homepage gerade nicht
 * erreichbar ist – Fehler landen im Log, der Cronjob holt den Stand später
 * ohnehin nach.
 */
export function scheduleWeeklyBookingSync(occurrenceId: number, trigger: string): void {
  void syncWeeklyOccurrenceBookings(occurrenceId)
    .then((result) => {
      if (result.skipped) return;
      if (result.created || result.deleted || result.conflict || result.failed) {
        console.log(
          `[bookings] Weekly ${occurrenceId} (${trigger}): ${result.created} gebucht, ${result.deleted} entfernt, ` +
            `${result.conflict} Konflikte, ${result.failed} Fehler`,
        );
      }
    })
    .catch((error) => {
      console.error(`[bookings] Abgleich für Weekly ${occurrenceId} (${trigger}) fehlgeschlagen:`, error);
    });
}

/**
 * Blockt die als "zu besetzen" eingetragenen Stationen eines unregelmäßigen
 * Events. Ohne konfigurierte Event-Kennung (`VATGER_EVENT_BOOKING_CID`) ist
 * das nicht möglich, weil jede Buchung auf der Homepage eine VATSIM ID
 * braucht.
 */
export async function syncEventStationBookings(eventId: number): Promise<BookingSyncResult> {
  const reference = eventBookingReference(eventId);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { roster: { include: { stations: true } } },
  });

  if (!event) {
    return emptyResult(reference, { skipped: "Event nicht gefunden." });
  }

  if (event.endTime.getTime() <= Date.now()) {
    return emptyResult(reference, { skipped: "Das Event liegt in der Vergangenheit." });
  }

  const blockingCid = getBlockingCid();
  if (!blockingCid) {
    return emptyResult(reference, {
      skipped: "Es ist keine VATSIM ID für Event-Blockbuchungen hinterlegt (VATGER_EVENT_BOOKING_CID).",
    });
  }

  // Die im Event gepflegten Stationen sind führend; ist dort nichts
  // hinterlegt, greifen die im Roster bestätigten Stationen.
  const stations = parseStations(event.staffedStations);
  const fallback = (event.roster?.stations ?? []).map((s) => s.callsign.trim().toUpperCase());
  const callsigns = Array.from(new Set(stations.length > 0 ? stations : fallback));

  if (callsigns.length === 0) {
    return emptyResult(reference, { skipped: "Für das Event sind keine zu besetzenden Stationen eingetragen." });
  }

  const desired: DesiredBooking[] = callsigns.map((callsign) => ({
    callsign,
    cid: blockingCid,
    start: event.startTime,
    end: event.endTime,
  }));

  return syncBookings(reference, desired);
}

/** Gibt die Stationen eines unregelmäßigen Events wieder frei. */
export async function releaseEventStationBookings(eventId: number): Promise<BookingSyncResult> {
  return releaseBookings(eventBookingReference(eventId));
}
