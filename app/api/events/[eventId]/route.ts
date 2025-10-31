import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { notifyRosterPublished } from "@/lib/notifications/notifyRosterPublished";
import { getUserWithPermissions } from "@/lib/acl/permissions";

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
  staffedStations: z.array(z.string()).optional(),
  status: z.enum(["PLANNING", "SIGNUP_OPEN", "SIGNUP_CLOSED", "ROSTER_PUBLISHED", "DRAFT", "CANCELLED"]).optional(),
  fir: z.string()
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
    console.log("error: Validation failed", "details:" + parsed.error.flatten().fieldErrors)
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
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
    (session.user.role !== "MAIN_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await prisma.eventSignup.deleteMany({ where: { eventId: Number(eventId) } });
  await prisma.event.delete({ where: { id: Number(eventId) } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const session = await getServerSession(authOptions);
  if(!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const user = await getUserWithPermissions(Number(session.user.cid))
  const fir = parsed.data.fir
  if(!fir) return NextResponse.json({ error: "Unauthorized", message: "Invalid FIR" }, { status: 401 });
  
  if (!user?.firScopedPermissions[fir].includes("event.edit")) {
    return NextResponse.json({ error: "Unauthorized", message: "You have no permission to create events (in this FIR)" }, { status: 401 });
  }

  try {
    const id = parseInt(eventId);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }
    const data = {
      ...(() => {
        const { fir, ...rest } = parsed.data;
        return rest;
      })(),
      firCode: fir,
    };
    
    const updatedEvent = await prisma.event.update({
      where: { id },
      data
    });

    // Notifications: Beispiel - wenn PLAN_UPLOADED gesetzt wird, Nutzer informieren
    if (parsed.data.status === "ROSTER_PUBLISHED") {
      const count = await notifyRosterPublished(Number(eventId));
      console.log(`✅ ${count} Benutzer benachrichtigt`);
    }

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