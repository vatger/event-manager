import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import z from "zod";
import { authOptions } from "@/lib/auth";

// --- Validation Schema für Events ---
const eventSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  bannerUrl: z.string().url(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startTime",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for endTime",
  }),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")),
  signupDeadline: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format for signupDeadline",
    }),
  staffedStations: z.array(z.string()).optional(),
  status: z.enum(["PLANNING", "SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "DRAFT", "CANCELLED"]).optional(),
});


export async function GET(request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: Number(eventId) },
    include: { signups: true }
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if (
    !session || 
    (session.user.role !== "ADMIN" && session.user.role !== "MAIN_ADMIN")
  ) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
  const event = await prisma.event.update({
    where: { id: Number(eventId) },
    data: {
        name: parsed.data.name,
        description: parsed.data.description,
        bannerUrl: parsed.data.bannerUrl,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        airports: parsed.data.airports,
        signupDeadline: parsed.data.signupDeadline
          ? new Date(parsed.data.signupDeadline)
          : null,
        staffedStations: parsed.data.staffedStations || [],
        status: parsed.data.status || "PLANNING",
        createdById: parseInt(session.user.id),
        rosterlink: body.rosterlink || null,
      },
  });
  return NextResponse.json(event);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if (
    !session || 
    (session.user.role !== "ADMIN" && session.user.role !== "MAIN_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await prisma.eventSignup.deleteMany({ where: { eventId: Number(eventId) } });
  await prisma.event.delete({ where: { id: Number(eventId) } });
  return NextResponse.json({ success: true });
}

const updateEventSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  bannerUrl: z.string().url().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")).optional(),
  signupDeadline: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format for signupDeadline",
    }).optional(),
  staffedStations: z.array(z.string()).optional(),
  status: z.enum(["PLANNING", "SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "DRAFT", "CANCELLED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if (
    !session || 
    (session.user.role !== "ADMIN" && session.user.role !== "MAIN_ADMIN")
  ) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  try {
    const body = await req.json();

    // Validate input
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = parseInt(eventId);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Update Event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: parsed.data,
    });

    // Notifications: Beispiel - wenn PLAN_UPLOADED gesetzt wird, Nutzer informieren
    if (parsed.data.status === "ROSTER_PUBLISHED") {
      const signups = await prisma.eventSignup.findMany({ where: { eventId: id }, select: { userCID: true } });
      if (signups.length > 0) {
        await prisma.$transaction(
          signups.map((s) => prisma.notification.create({
            data: {
              userCID: s.userCID,
              eventId: id,
              type: "EVENT",
              title: `Plan veröffentlicht: ${updatedEvent.name}`,
              message: `Das Roster/der Plan für ${updatedEvent.name} wurde veröffentlicht.`,
            },
          }))
        );
      }
    }

    return NextResponse.json(updatedEvent, { status: 200 }, );
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}