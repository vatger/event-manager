import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userCanManageWeekly } from "@/lib/acl/permissions";
import {
  getBookings,
  releaseWeeklyOccurrenceBookings,
  syncWeeklyOccurrenceBookings,
  weeklyBookingReference,
} from "@/lib/bookings/eventStationBookings";
import { isBookingApiConfigured, VatgerBookingApiError } from "@/lib/bookings/vatgerBookingClient";

/**
 * Stationsbuchungen einer Weekly-Instanz.
 *
 * Der Abgleich läuft beim Veröffentlichen des Rosters und über den Cronjob
 * automatisch; hier lässt er sich zusätzlich von Hand anstoßen.
 */

interface RouteParams {
  params: Promise<{ id: string; occurrenceId: string }>;
}

/** Prüft Parameter und Berechtigung und liefert andernfalls die Fehlerantwort. */
async function resolve(params: RouteParams["params"]): Promise<
  { error: NextResponse; occurrenceId?: undefined } | { error?: undefined; occurrenceId: number }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { id, occurrenceId } = await params;
  const configId = parseInt(id);
  const occurrenceIdNum = parseInt(occurrenceId);

  if (isNaN(configId) || isNaN(occurrenceIdNum)) {
    return { error: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) };
  }

  if (!(await userCanManageWeekly(Number(session.user.cid), configId))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const occurrence = await prisma.weeklyEventOccurrence.findUnique({
    where: { id: occurrenceIdNum },
    select: { id: true, configId: true },
  });

  if (!occurrence || occurrence.configId !== configId) {
    return { error: NextResponse.json({ error: "Occurrence not found" }, { status: 404 }) };
  }

  return { occurrenceId: occurrenceIdNum };
}

function handleError(error: unknown) {
  if (error instanceof VatgerBookingApiError) {
    console.error("[weekly bookings] VATGER API error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  console.error("[weekly bookings] Error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// Aktuellen Buchungsstand abfragen
export async function GET(req: NextRequest, { params }: RouteParams) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;

  try {
    return NextResponse.json({
      configured: isBookingApiConfigured(),
      reference: weeklyBookingReference(resolved.occurrenceId),
      bookings: await getBookings(weeklyBookingReference(resolved.occurrenceId)),
    });
  } catch (error) {
    return handleError(error);
  }
}

// Buchungen mit dem Roster abgleichen
export async function POST(req: NextRequest, { params }: RouteParams) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;

  try {
    return NextResponse.json(await syncWeeklyOccurrenceBookings(resolved.occurrenceId));
  } catch (error) {
    return handleError(error);
  }
}

// Stationen wieder freigeben
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const resolved = await resolve(params);
  if (resolved.error) return resolved.error;

  try {
    return NextResponse.json(await releaseWeeklyOccurrenceBookings(resolved.occurrenceId));
  } catch (error) {
    return handleError(error);
  }
}
