import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { userHasFirPermission, isVatgerEventleitung } from "@/lib/acl/permissions";
import { addWeeks, startOfDay } from "date-fns";

// Validation schema for weekly event configuration
const weeklyEventConfigSchema = z.object({
  firId: z.number().optional().nullable(),
  name: z.string().min(3).max(100),
  weekday: z.number().min(0).max(6),
  weeksOn: z.number().min(1).max(52),
  weeksOff: z.number().min(0).max(52),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startDate",
  }),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")).optional().nullable(),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format").optional().nullable(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format").optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  bannerUrl: z.string().url().optional().nullable().or(z.literal("")), // Added for banner image URL
  minStaffing: z.number().min(0).optional().nullable(),
  requiresRoster: z.boolean().optional(),
  staffedStations: z.array(z.string()).optional().nullable(),
  signupDeadlineHours: z.number().min(1).max(168).optional().nullable(), // Max 1 week
  enabled: z.boolean().optional(),
});

/**
 * GET /api/admin/discord/weekly-events
 * List all weekly event configurations
 * Returns configs with their next 5 upcoming occurrences
 */
export async function GET(request: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get user's FIR affiliation
    const user = await prisma.user.findUnique({
      where: { cid: Number(session.user.cid) },
      select: { firId: true, role: true },
    });

    const isVatgerAdmin = await isVatgerEventleitung(Number(session.user.cid));

    // Build filter based on permissions
    let firFilter = {};
    if (!isVatgerAdmin && user?.firId) {
      // Only show configs for user's FIR if they're not VATGER admin
      firFilter = { firId: user.firId };
    }

    const configs = await prisma.weeklyEventConfiguration.findMany({
      where: firFilter,
      include: {
        fir: {
          select: {
            code: true,
            name: true,
          },
        },
        occurrences: {
          where: {
            date: {
              gte: new Date(),
            },
          },
          orderBy: {
            date: "asc",
          },
          take: 5,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching weekly event configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly event configurations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/discord/weekly-events
 * Create a new weekly event configuration
 */
export async function POST(req: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = weeklyEventConfigSchema.safeParse(body);

    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Get user's FIR
    const user = await prisma.user.findUnique({
      where: { cid: Number(session.user.cid) },
      select: { firId: true },
    });

    const targetFirId = parsed.data.firId ?? user?.firId ?? null;

    // Check permissions
    const isVatgerAdmin = await isVatgerEventleitung(Number(session.user.cid));
    
    if (targetFirId) {
      const fir = await prisma.fIR.findUnique({
        where: { id: targetFirId },
        select: { code: true },
      });

      if (!fir) {
        return NextResponse.json({ error: "FIR not found" }, { status: 404 });
      }

      const hasPermission = await userHasFirPermission(
        Number(session.user.cid),
        fir.code,
        "event.create"
      );

      if (!hasPermission && !isVatgerAdmin) {
        return NextResponse.json(
          { error: "You don't have permission to create weekly events for this FIR" },
          { status: 403 }
        );
      }
    } else if (!isVatgerAdmin) {
      // Only VATGER admins can create global weekly events
      return NextResponse.json(
        { error: "You don't have permission to create global weekly events" },
        { status: 403 }
      );
    }

    // Create the configuration
    const config = await prisma.weeklyEventConfiguration.create({
      data: {
        firId: targetFirId,
        name: parsed.data.name,
        weekday: parsed.data.weekday,
        weeksOn: parsed.data.weeksOn,
        weeksOff: parsed.data.weeksOff,
        startDate: new Date(parsed.data.startDate),
        airports: parsed.data.airports ? (JSON.stringify(parsed.data.airports) as any) : null,
        startTime: parsed.data.startTime || null,
        endTime: parsed.data.endTime || null,
        description: parsed.data.description || null,
        bannerUrl: parsed.data.bannerUrl || null, // Added for banner image URL
        minStaffing: parsed.data.minStaffing ?? 0,
        requiresRoster: parsed.data.requiresRoster ?? false,
        staffedStations: parsed.data.staffedStations ? (JSON.stringify(parsed.data.staffedStations) as any) : null,
        signupDeadlineHours: parsed.data.signupDeadlineHours ?? 24,
        enabled: parsed.data.enabled ?? true,
      },
    });

    // Generate initial occurrences (next 6 months)
    await generateOccurrences(config.id);

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("Error creating weekly event config:", error);
    return NextResponse.json(
      { error: "Failed to create weekly event configuration" },
      { status: 500 }
    );
  }
}

/**
 * Generate occurrences for a weekly event configuration
 * Creates occurrences for the next 6 months
 */
async function generateOccurrences(configId: number) {
  if (!prisma) return;

  const config = await prisma.weeklyEventConfiguration.findUnique({
    where: { id: configId },
  });

  if (!config) return;

  const today = startOfDay(new Date());
  const sixMonthsFromNow = addWeeks(today, 26);

  // Calculate occurrences based on the pattern
  const occurrences: Date[] = [];
  let currentDate = startOfDay(new Date(config.startDate));

  // Adjust to the correct weekday if needed
  while (currentDate.getDay() !== config.weekday) {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Add one day
  }

  let weekCounter = 0;
  const totalCycleWeeks = config.weeksOn + config.weeksOff;
  
  while (currentDate <= sixMonthsFromNow) {
    // Only add occurrence if we're in the "on" weeks
    if (weekCounter < config.weeksOn) {
      if (currentDate >= today) {
        occurrences.push(new Date(currentDate));
      }
    }
    
    // Move to next week
    currentDate = addWeeks(currentDate, 1);
    weekCounter++;
    
    // Reset counter after completing a full cycle
    if (weekCounter >= totalCycleWeeks) {
      weekCounter = 0;
    }
  }

  // Create occurrences in database
  for (const date of occurrences) {
    await prisma.weeklyEventOccurrence.upsert({
      where: {
        configId_date: {
          configId: config.id,
          date: date,
        },
      },
      create: {
        configId: config.id,
        date: date,
        signupDeadline: config.signupDeadlineHours
          ? new Date(date.getTime() - config.signupDeadlineHours * 60 * 60 * 1000)
          : null,
        eventId: null,
      },
      update: {
        signupDeadline: config.signupDeadlineHours
          ? new Date(date.getTime() - config.signupDeadlineHours * 60 * 60 * 1000)
          : null,
      },
    });
  }
}
