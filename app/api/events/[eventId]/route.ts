import { NextRequest, NextResponse } from "next/server";
import { logEventChanges } from "@/lib/events/eventActivity";
import { applyStationsToRoster, stationsWithShifts } from "@/lib/roster/eventStations";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  eventBookingTrigger,
  releaseEventStationBookings,
  scheduleEventBookingSync,
} from "@/lib/bookings/eventStationBookings";
import { authOptions } from "@/lib/auth";
import { notifyRosterPublished } from "@/lib/notifications/notifyRosterPublished";
import { isVatgerEventleitung, hasAdminAccess } from "@/lib/acl/permissions";
import { denyMissing, getEventCapabilities } from "@/lib/events/eventAccess";
import { changedFields, requiredCapabilities, type EventStatus } from "@/lib/events/eventChangeRules";
import { invalidateSignupTable } from "@/lib/cache/signupTableCache";
import { getSessionUser } from "@/lib/getSessionUser";

// --- Validation Schema für Events ---
const eventSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  bannerUrl: z.string().optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startTime",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for endTime",
  }),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")),
  signupDeadline: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format for signupDeadline",
    }).optional().nullable(),
  signupSlotMinutes: z.number().int().refine((val) => [15, 30].includes(val), {
    message: "signupSlotMinutes must be 15 or 30",
  }).optional().nullable(),
  staffedStations: z.array(z.string()).optional(),
  status: z.enum(["PLANNING", "SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "DRAFT", "CANCELLED"]).optional(),
  firCode: z.string().nullable().optional()
});


export async function GET(request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: Number(eventId) },
    include: {
      signups: true,
      responsibles: { include: { user: { select: { cid: true, name: true } } } },
    }
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if(!(await hasAdminAccess(Number(user.cid))) && event.status == "DRAFT"){
    return NextResponse.json({error: "This Event is not public yet"}, { status: 403 });
  }
  const flatResponsibles = event.responsibles.map((r) => r.user);

  // Ein verborgener Banner ist nur für die Öffentlichkeit verborgen. Das
  // Eventteam braucht die URL – sonst schickt das Bearbeiten-Formular ein
  // leeres Feld zurück, und Speichern sähe aus wie „Banner entfernen“.
  if (!event.bannerVisible) {
    const capabilities = await getEventCapabilities(Number(user.cid), event.id);
    if (!capabilities?.banner && !capabilities?.isTeamMember) {
      return NextResponse.json({ ...event, responsibles: flatResponsibles, bannerUrl: null });
    }
  }

  return NextResponse.json({ ...event, responsibles: flatResponsibles });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    console.log("error: Validation failed", "details:" + parsed.error.flatten().fieldErrors)
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const firbyevent = await prisma.event.findUnique({ where: { id: Number(eventId) } });
  if(!firbyevent?.firCode) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const cid = Number(session.user.cid);
  if(parsed.data.firCode && (parsed.data.firCode != firbyevent.firCode && !await isVatgerEventleitung(cid))) {
    return NextResponse.json({ error: "Nur die VATGER-Eventleitung kann ein Event in eine andere FIR verschieben." }, { status: 403 });
  }
  const fir = parsed.data.firCode || firbyevent.firCode

  // Was das Formular speichern würde – geprüft wird, was sich davon ändert
  // Fehlt ein Feld im Request, bleibt der gespeicherte Wert – das Formular
  // lässt Felder weg, die der Nutzer nicht ändern darf.
  const sent = (key: string) => body !== null && typeof body === "object" && key in body;
  const putData = {
    name: parsed.data.name,
    description: sent("description") ? parsed.data.description || "" : firbyevent.description,
    bannerUrl: sent("bannerUrl") ? parsed.data.bannerUrl || null : firbyevent.bannerUrl,
    startTime: new Date(parsed.data.startTime),
    endTime: new Date(parsed.data.endTime),
    airports: parsed.data.airports,
    signupDeadline: sent("signupDeadline")
      ? parsed.data.signupDeadline ? new Date(parsed.data.signupDeadline) : null
      : firbyevent.signupDeadline,
    signupSlotMinutes: parsed.data.signupSlotMinutes ?? firbyevent.signupSlotMinutes ?? 30,
    staffedStations: parsed.data.staffedStations ?? firbyevent.staffedStations ?? [],
    status: parsed.data.status || firbyevent.status,
    rosterlink: sent("rosterlink") ? body.rosterlink || null : firbyevent.rosterlink,
    firCode: fir,
  };
  const capabilities = await getEventCapabilities(cid, Number(eventId));
  if (!capabilities) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const putChanges = changedFields(firbyevent, putData);
  const putDenied = denyMissing(
    capabilities,
    requiredCapabilities(putChanges, putData.status as EventStatus)
  );
  if (putDenied) return putDenied;

  // Eine Stationsliste für Event und Besetzungsplan: Stationen, auf denen im
  // Plan schon Schichten liegen, lassen sich hier nicht still entfernen –
  // sonst verschwänden die Schichten mit. Das geht im Editor, wo man sieht,
  // was dabei wegfällt.
  if (parsed.data.staffedStations && parsed.data.staffedStations.length > 0) {
    const conflicts = await stationsWithShifts(Number(eventId), parsed.data.staffedStations);
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: `${conflicts
            .map((c) => `${c.callsign} (${c.shifts} ${c.shifts === 1 ? "Schicht" : "Schichten"})`)
            .join(", ")} ${conflicts.length === 1 ? "ist" : "sind"} im Besetzungsplan noch belegt. Entferne die Schichten dort oder behalte die Station.`,
          code: "stations_in_use",
        },
        { status: 409 }
      );
    }
  }

  const event = await prisma.event.update({
    where: { id: Number(eventId) },
    data: putData,
  });
  await logEventChanges(Number(eventId), cid, firbyevent, event);
  // … und der Plan zieht die geänderte Liste nach.
  if (parsed.data.staffedStations && parsed.data.staffedStations.length > 0) {
    const changed = await applyStationsToRoster(Number(eventId), parsed.data.staffedStations);
    if (changed) broadcastRosterChange(Number(eventId), null);
  }

  // Mit dem Öffnen der Anmeldung stehen die Stationen fest genug, um sie auf
  // der Homepage zu blocken; danach zieht jede Änderung an den Stationen nach.
  const bookingTrigger = eventBookingTrigger(
    firbyevent.status,
    event.status,
    firbyevent.staffedStations,
    event.staffedStations,
  );
  if (bookingTrigger) scheduleEventBookingSync(Number(eventId), bookingTrigger);

  // Beim Absagen die geblockten Stationen wieder freigeben, sofern das im
  // Dialog bestätigt wurde. Ein Fehler darf die Absage nicht verhindern.
  if (parsed.data.status === "CANCELLED" && body?.releaseBookings === true) {
    try {
      const released = await releaseEventStationBookings(Number(eventId));
      console.log(`[bookings] Event ${eventId} abgesagt: ${released.deleted} Buchungen zurückgezogen`);
    } catch (error) {
      console.error("[PUT event] Freigabe der Stationsbuchungen fehlgeschlagen:", error);
    }
  }

  await invalidateSignupTable(Number(eventId))
  return NextResponse.json(event);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const firbyevent = await prisma.event.findUnique({
    where: {
      id: Number(eventId)
    },
    select: {
      firCode: true
    }
  })
  
  if(!firbyevent?.firCode) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const deleteCapabilities = await getEventCapabilities(Number(session.user.cid), Number(eventId));
  if (!deleteCapabilities) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const deleteDenied = denyMissing(deleteCapabilities, ["delete"]);
  if (deleteDenied) return deleteDenied;

  // Die Stationsbuchungen auf der Homepage überleben das Event - sie werden
  // nur zurückgezogen, wenn das beim Löschen ausdrücklich bestätigt wurde.
  if (req.nextUrl.searchParams.get("releaseBookings") === "true") {
    try {
      await releaseEventStationBookings(Number(eventId));
    } catch (error) {
      console.error("[DELETE event] Freigabe der Stationsbuchungen fehlgeschlagen:", error);
      return NextResponse.json(
        { error: "Die Stationsbuchungen konnten nicht zurückgezogen werden, das Event wurde nicht gelöscht." },
        { status: 502 }
      );
    }
  }

  await prisma.eventSignup.deleteMany({ where: { eventId: Number(eventId) } });
  await prisma.event.delete({ where: { id: Number(eventId) } });
  await invalidateSignupTable(Number(eventId))
  return NextResponse.json({ success: true });
}

const updateEventSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  bannerUrl: z.string().optional().nullable(),
  bannerVisible: z.boolean().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")).optional(),
  signupDeadline: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format for signupDeadline",
    }).optional().nullable(),
  signupSlotMinutes: z.number().int().refine((val) => [15, 30].includes(val), {
    message: "signupSlotMinutes must be 15 or 30",
  }).optional().nullable(),
  staffedStations: z.array(z.string()).optional(),
  rosterlink: z.string().url("Rosterlink ist keine gültige URL").nullable().optional(),
  status: z.enum(["PLANNING", "SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "DRAFT", "CANCELLED"]).optional(),
  firCode: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if(!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // const session = {
  //   user: {
  //     cid: 1649341,
  //   }
  // }
  
  const body = await req.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const cid = Number(session.user.cid);
  const firbyevent = await prisma.event.findUnique({ where: { id: Number(eventId) } });
  if(!firbyevent?.firCode) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if(parsed.data.firCode && parsed.data.firCode != firbyevent.firCode && !await isVatgerEventleitung(cid)) {
    return NextResponse.json({ error: "Nur die VATGER-Eventleitung kann ein Event in eine andere FIR verschieben." }, { status: 403 });
  }

  // Jede Art von Änderung hat ihr eigenes Recht (siehe eventChangeRules.ts).
  // Geprüft wird nur, was sich wirklich ändert.
  const capabilities = await getEventCapabilities(cid, Number(eventId));
  if (!capabilities) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const patchChanges = changedFields(firbyevent, parsed.data);
  const patchDenied = denyMissing(
    capabilities,
    requiredCapabilities(patchChanges, parsed.data.status as EventStatus | undefined)
  );
  if (patchDenied) return patchDenied;

  try {
    const id = parseInt(eventId);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Eine Stationsliste für Event und Besetzungsplan: Stationen, auf denen im
    // Plan schon Schichten liegen, lassen sich hier nicht still entfernen –
    // sonst verschwänden die Schichten mit. Das geht im Editor, wo man sieht,
    // was dabei wegfällt.
    if (parsed.data.staffedStations && parsed.data.staffedStations.length > 0) {
      const conflicts = await stationsWithShifts(Number(eventId), parsed.data.staffedStations);
      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: `${conflicts
              .map((c) => `${c.callsign} (${c.shifts} ${c.shifts === 1 ? "Schicht" : "Schichten"})`)
              .join(", ")} ${conflicts.length === 1 ? "ist" : "sind"} im Besetzungsplan noch belegt. Entferne die Schichten dort oder behalte die Station.`,
            code: "stations_in_use",
          },
          { status: 409 }
        );
      }
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: parsed.data,
      include: {
        responsibles: { include: { user: { select: { cid: true, name: true } } } },
      },
    });
    await logEventChanges(id, cid, firbyevent, updatedEvent);

    // Mit dem Öffnen der Anmeldung stehen die Stationen fest genug, um sie auf
    // der Homepage zu blocken; danach zieht jede Änderung an den Stationen nach.
    // … und der Plan zieht die geänderte Liste nach.
    if (parsed.data.staffedStations && parsed.data.staffedStations.length > 0) {
      const changed = await applyStationsToRoster(Number(eventId), parsed.data.staffedStations);
      if (changed) broadcastRosterChange(Number(eventId), null);
    }

    const bookingTrigger = eventBookingTrigger(
      firbyevent.status,
      updatedEvent.status,
      firbyevent.staffedStations,
      updatedEvent.staffedStations,
    );
    if (bookingTrigger) scheduleEventBookingSync(id, bookingTrigger);

    // Beim Absagen die geblockten Stationen wieder freigeben, sofern das im
    // Dialog bestätigt wurde. Ein Fehler darf die Absage nicht verhindern.
    if (parsed.data.status === "CANCELLED" && body?.releaseBookings === true) {
      try {
        const released = await releaseEventStationBookings(id);
        console.log(`[bookings] Event ${id} abgesagt: ${released.deleted} Buchungen zurückgezogen`);
      } catch (error) {
        console.error("[PATCH event] Freigabe der Stationsbuchungen fehlgeschlagen:", error);
      }
    }

    // Notifications: wenn PLAN_UPLOADED gesetzt wird, Nutzer informieren
    if (parsed.data.status === "ROSTER_PUBLISHED") {
      const count = await notifyRosterPublished(Number(eventId));
      console.log(`✅ ${count} Benutzer benachrichtigt`);
    }

    await invalidateSignupTable(Number(eventId))
    return NextResponse.json({ ...updatedEvent, responsibles: updatedEvent.responsibles.map((r) => r.user) }, { status: 200 });
  } catch (err) {
    if(err instanceof z.ZodError){
      console.error("Error updating event:", err);
    }
    
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}