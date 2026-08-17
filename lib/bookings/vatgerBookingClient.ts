/**
 * Client für die Event-Booking-Schnittstelle der VATGER Homepage.
 *
 * Über diese Schnittstelle werden Stationen als "vatger Event Buchung"
 * geblockt. Solche Buchungen haben auf der Homepage Vorrang: reguläre
 * Buchungen derselben Station, die im Weg stehen, werden entfernt und die
 * betroffenen Lotsen benachrichtigt.
 *
 * Die Schnittstelle ist optional – ist sie nicht konfiguriert, verhält sich
 * der Eventmanager wie bisher und meldet lediglich, dass nichts gebucht
 * wurde (siehe `isBookingApiConfigured`).
 */

/** Eine zu buchende Station. */
export interface VatgerBookingRequest {
  /** Logon der Station, z. B. "EDDF_TWR" */
  callsign: string;
  /** VATSIM ID, für die die Station gebucht wird */
  cid: number;
  /** Beginn der Buchung als ISO-8601-Zeitstempel in UTC */
  start: string;
  /** Ende der Buchung als ISO-8601-Zeitstempel in UTC */
  end: string;
}

export type VatgerBookingStatus = "created" | "existing" | "conflict" | "failed";

/** Ergebnis einer einzelnen Buchung. */
export interface VatgerBookingResult {
  callsign: string;
  cid: number;
  reference: string | null;
  status: VatgerBookingStatus;
  message: string;
  booking_id: number | null;
  removed_bookings: number;
}

export interface VatgerCreateResponse {
  reference: string | null;
  created: number;
  existing: number;
  conflict: number;
  failed: number;
  results: VatgerBookingResult[];
}

/** Eine auf der Homepage bereits bestehende Event-Buchung. */
export interface VatgerBooking {
  booking_id: number;
  callsign: string | null;
  cid: number;
  start: string;
  end: string;
  reference: string | null;
}

/** Eine Buchung, deren Löschung die Homepage quittiert hat. */
export type VatgerDeletedBooking = VatgerBooking & {
  status: "deleted" | "failed";
  message: string;
};

export interface VatgerDeleteResponse {
  reference: string | null;
  deleted: number;
  failed: number;
  results: VatgerDeletedBooking[];
}

/** Fehler der Homepage-Schnittstelle inklusive HTTP-Status. */
export class VatgerBookingApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VatgerBookingApiError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

function getConfig(): { url: string; token: string } | null {
  const url = process.env.VATGER_BOOKING_API;
  const token = process.env.VATGER_BOOKING_API_TOKEN || process.env.VATGER_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Ist die Buchungsschnittstelle konfiguriert? Ohne Konfiguration werden
 * keine Buchungen versucht, damit lokale Installationen ohne Zugang zur
 * Homepage weiterhin ohne Fehler laufen.
 */
export function isBookingApiConfigured(): boolean {
  return getConfig() !== null;
}

async function request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const config = getConfig();
  if (!config) {
    throw new VatgerBookingApiError("Die VATGER Buchungsschnittstelle ist nicht konfiguriert.", 0);
  }

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new VatgerBookingApiError(`Die VATGER Homepage ist nicht erreichbar: ${reason}`, 0);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new VatgerBookingApiError(
      `Die VATGER Homepage hat die Anfrage abgelehnt (HTTP ${response.status}): ${text.slice(0, 300)}`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new VatgerBookingApiError("Die VATGER Homepage hat keine gültige JSON-Antwort geliefert.", response.status);
  }
}

/** Listet alle Event-Buchungen zu einer Referenz auf. */
export async function listEventBookings(reference: string): Promise<VatgerBooking[]> {
  return request<VatgerBooking[]>("GET", `?reference=${encodeURIComponent(reference)}`);
}

/** Legt Event-Buchungen an. Die Schnittstelle ist idempotent. */
export async function createEventBookings(
  reference: string,
  bookings: VatgerBookingRequest[],
): Promise<VatgerCreateResponse> {
  return request<VatgerCreateResponse>("POST", "", { reference, bookings });
}

/** Entfernt Event-Buchungen – entweder eine ganze Referenz oder einzelne IDs. */
export async function deleteEventBookings(params: {
  reference?: string;
  bookingIds?: number[];
}): Promise<VatgerDeleteResponse> {
  const body: Record<string, unknown> = {};
  if (params.reference) body.reference = params.reference;
  if (params.bookingIds?.length) body.booking_ids = params.bookingIds;
  return request<VatgerDeleteResponse>("DELETE", "", body);
}
