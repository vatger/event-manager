import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserWithPermissions, userHasFirPermission } from "@/lib/acl/permissions";

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
  firCode: z.string().nullable().optional(),
});

// --- GET: Alle Events ---
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const firCode = searchParams.get("fir");

  let where = {};
  if (firCode && firCode !== "ALL") {
    where = { firCode };
  }

  try {
    const url = new URL(req.url);
    const userCIDParam = url.searchParams.get("userCID");
    const parsedCID = userCIDParam ? parseInt(userCIDParam, 10) : NaN;
    const userCID = Number.isNaN(parsedCID) ? null : parsedCID;

    const events = await prisma.event.findMany({
      orderBy: { startTime: "asc" },
      where,
      include: {
        _count: {
          select: { signups: true },
        },
      },
    });

    let signedSet: Set<number> | null = null;
    if (userCID !== null) {
      const eventIds = events.map((e) => e.id);
      if (eventIds.length > 0) {
        const signups = await prisma.eventSignup.findMany({
          where: {
            userCID,
            eventId: { in: eventIds },
          },
          select: { eventId: true },
        });
        signedSet = new Set(signups.map((s) => s.eventId));
      } else {
        signedSet = new Set();
      }
    }

    const result = events.map(({ _count, ...event }) => ({
      ...event,
      registrations: _count?.signups ?? 0,
      ...(signedSet ? { isSignedUp: signedSet.has(event.id) } : {}),
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// --- POST: Neues Event erstellen ---
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if(!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      console.log("Validation errors:", parsed.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const user = await getUserWithPermissions(Number(session.user.cid))
    const fir = parsed.data.firCode || user?.fir?.code
    if(!fir) return NextResponse.json({ error: "Unauthorized", message: "Invalid FIR" }, { status: 401 });
    
    if (await userHasFirPermission(Number(session.user.cid), fir, "event.create") === false) {
      return NextResponse.json({ error: "Unauthorized", message: "You have no permission to create events (in this FIR)" }, { status: 401 });
    }

    const event = await prisma.event.create({
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
        firCode: fir,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
