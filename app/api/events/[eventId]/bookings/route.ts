import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { userhasPermissiononEvent } from "@/lib/acl/permissions";
import {
  eventBookingReference,
  getBookings,
  releaseEventStationBookings,
  releaseSingleEventBookings,
  syncEventStationBookings,
} from "@/lib/bookings/eventStationBookings";
import { isBookingApiConfigured, VatgerBookingApiError } from "@/lib/bookings/vatgerBookingClient";

/**
 * Stationsbuchungen eines unregelmäßigen Events.
 *
 * Geblockt wird automatisch beim Öffnen der Anmeldung und bei Änderungen an
 * den Stationen; über diese Route lässt sich der Stand im Stationen-Tab
 * einsehen, nachziehen und wieder freigeben.
 */

/** Liefert die abzulehnende Antwort, falls der Nutzer nicht berechtigt ist. */
async function denyUnauthorized(eventId: number): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cid = Number(user.cid);
  const allowed =
    (await userhasPermissiononEvent(cid, eventId, "event.edit")) ||
    (await userhasPermissiononEvent(cid, eventId, "roster.publish"));

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

function handleError(error: unknown) {
  if (error instanceof VatgerBookingApiError) {
    console.error("[event bookings] VATGER API error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  console.error("[event bookings] Error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// Aktuellen Buchungsstand des Events abfragen
export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const denied = await denyUnauthorized(eventId);
  if (denied) return denied;

  try {
    return NextResponse.json({
      configured: isBookingApiConfigured(),
      reference: eventBookingReference(eventId),
      bookings: await getBookings(eventBookingReference(eventId)),
    });
  } catch (error) {
    return handleError(error);
  }
}

// Stationen blocken
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const denied = await denyUnauthorized(eventId);
  if (denied) return denied;

  try {
    return NextResponse.json(await syncEventStationBookings(eventId));
  } catch (error) {
    return handleError(error);
  }
}

// Stationen wieder freigeben - alle, oder die im Body genannten Buchungen
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const denied = await denyUnauthorized(eventId);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const bookingIds: unknown = body?.bookingIds;

  try {
    if (Array.isArray(bookingIds) && bookingIds.length > 0) {
      const ids = bookingIds.filter((id): id is number => Number.isInteger(id));
      if (ids.length === 0) {
        return NextResponse.json({ error: "bookingIds must be integers" }, { status: 400 });
      }
      return NextResponse.json(await releaseSingleEventBookings(eventId, ids));
    }

    return NextResponse.json(await releaseEventStationBookings(eventId));
  } catch (error) {
    return handleError(error);
  }
}
