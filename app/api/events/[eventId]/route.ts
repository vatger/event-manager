import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { notifyRosterPublished } from "@/lib/notifications/notifyRosterPublished";
import { getUserWithPermissions, isVatgerEventleitung, userHasFirPermission } from "@/lib/acl/permissions";
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
    include: { signups: true }
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(event);
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

  const firbyevent = await prisma.event.findUnique({
    where: {
      id: Number(eventId)
    },
    select: {
      firCode: true
    }
  })
  if(!firbyevent?.firCode) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  
  if(parsed.data.firCode && (parsed.data.firCode != firbyevent.firCode && !await isVatgerEventleitung(Number(session.user.cid)))) {
    return NextResponse.json({ error: "Unauthorized", message: "Only MainAdmins and  VATGER can move the event to another FIR"}, { status: 401 });
  }
  const fir = parsed.data.firCode || firbyevent.firCode
  if(!fir) return NextResponse.json({ error: "Invalid FIR" }, { status: 401 });
  
  if (!await userHasFirPermission(Number(session.user.cid), fir, "event.edit") && !await isVatgerEventleitung(Number(session.user.cid))) {
    return NextResponse.json({ error: "Unauthorized", message: "You have no permission to edit events (in this FIR)", fir}, { status: 401 });
  }

  const event = await prisma.event.update({
    where: { id: Number(eventId) },
    data: {
        name: parsed.data.name,
        description: parsed.data.description || "",
        bannerUrl: parsed.data.bannerUrl || null,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        airports: parsed.data.airports,
        signupDeadline: parsed.data.signupDeadline
          ? new Date(parsed.data.signupDeadline)
          : null,
        signupSlotMinutes: parsed.data.signupSlotMinutes ?? 30,
        staffedStations: parsed.data.staffedStations || [],
        status: parsed.data.status || "PLANNING",
        createdById: parseInt(session.user.id),
        rosterlink: body.rosterlink || null,
        firCode: fir,
      },
  });
  await invalidateSignupTable(Number(eventId))
  return NextResponse.json(event);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
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
  if (!await userHasFirPermission(Number(session.user.cid), firbyevent.firCode, "event.delete") && !await isVatgerEventleitung(Number(session.user.cid))) {
    return NextResponse.json({ error: "Unauthorized", message: "You have no permission to delete events (in this FIR)", firbyevent}, { status: 401 });
  }

  await prisma.eventSignup.deleteMany({ where: { eventId: Number(eventId) } });
  await prisma.event.delete({ where: { id: Number(eventId) } });
  await invalidateSignupTable(Number(eventId))
  return NextResponse.json({ success: true });
}

const updateEventSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
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
  firCode: z.string().optional()
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
  const user = await getUserWithPermissions(Number(session.user.cid))
  if(!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const firbyevent = await prisma.event.findUnique({
    where: {
      id: Number(eventId)
    },
    select: {
      firCode: true
    }
  })
  if(!firbyevent?.firCode) return NextResponse.json({ error: "Event not found" }, { status: 404 });


  if(parsed.data.firCode && (parsed.data.firCode != firbyevent.firCode && user.effectiveLevel != "MAIN_ADMIN" && user.effectiveLevel != "VATGER_LEITUNG")) {
    return NextResponse.json({ error: "Unauthorized", message: "Only MainAdmins and VATGER can move the event to another FIR"}, { status: 401 });
  }
  
  const fir = parsed.data.firCode || firbyevent.firCode
  if(!fir) return NextResponse.json({ error: "Invalid FIR" }, { status: 401 });
  
  if (!await userHasFirPermission(user.cid, fir, "event.edit") && !await isVatgerEventleitung(user.cid)) {
    return NextResponse.json({ error: "Unauthorized", message: "You have no permission to edit events (in this FIR)", fir}, { status: 401 });
  }

  try {
    const id = parseInt(eventId);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }
    
    if(parsed.data.status === "ROSTER_PUBLISHED"){
      if(!await userHasFirPermission(user.cid, fir, "roster.publish")) {
        return NextResponse.json({ error: "Insufficient permissions", message: "You need roster.publish in your FIR for this action"}, { status: 403})
      }
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: parsed.data
    });

    // Notifications: wenn PLAN_UPLOADED gesetzt wird, Nutzer informieren
    if (parsed.data.status === "ROSTER_PUBLISHED") {
      const count = await notifyRosterPublished(Number(eventId));
      console.log(`✅ ${count} Benutzer benachrichtigt`);
    }

    await invalidateSignupTable(Number(eventId))
    return NextResponse.json(updatedEvent, { status: 200 }, );
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