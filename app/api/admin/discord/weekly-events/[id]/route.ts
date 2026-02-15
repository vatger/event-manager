import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { userHasFirPermission, isVatgerEventleitung } from "@/lib/acl/permissions";
import { addWeeks, startOfDay } from "date-fns";

// Validation schema for updating weekly event configuration
const weeklyEventConfigUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  weekday: z.number().min(0).max(6).optional(),
  weeksOn: z.number().min(1).max(52).optional(),
  weeksOff: z.number().min(0).max(52).optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startDate",
  }).optional(),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")).optional().nullable(),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format").optional().nullable(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format").optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  minStaffing: z.number().min(0).optional().nullable(),
  requiresRoster: z.boolean().optional(),
  staffedStations: z.array(z.string()).optional().nullable(),
  signupDeadlineHours: z.number().min(1).max(168).optional().nullable(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/admin/discord/weekly-events/[id]
 * Get a single weekly event configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: Number(id) },
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
          take: 10,
        },
      },
    });

    if (!config) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching weekly event config:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly event configuration" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/discord/weekly-events/[id]
 * Update a weekly event configuration
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = weeklyEventConfigUpdateSchema.safeParse(body);

    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Get existing config
    const existingConfig = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: Number(id) },
      include: {
        fir: {
          select: { code: true },
        },
      },
    });

    if (!existingConfig) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    // Check permissions
    const isVatgerAdmin = await isVatgerEventleitung(Number(session.user.cid));
    
    if (existingConfig.firId) {
      const hasPermission = await userHasFirPermission(
        Number(session.user.cid),
        existingConfig.fir?.code || "",
        "event.edit"
      );

      if (!hasPermission && !isVatgerAdmin) {
        return NextResponse.json(
          { error: "You don't have permission to edit this weekly event" },
          { status: 403 }
        );
      }
    } else if (!isVatgerAdmin) {
      return NextResponse.json(
        { error: "Only VATGER admins can edit global weekly events" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.weekday !== undefined) updateData.weekday = parsed.data.weekday;
    if (parsed.data.weeksOn !== undefined) updateData.weeksOn = parsed.data.weeksOn;
    if (parsed.data.weeksOff !== undefined) updateData.weeksOff = parsed.data.weeksOff;
    if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate);
    if (parsed.data.airports !== undefined) updateData.airports = parsed.data.airports ? JSON.stringify(parsed.data.airports) : null;
    if (parsed.data.startTime !== undefined) updateData.startTime = parsed.data.startTime;
    if (parsed.data.endTime !== undefined) updateData.endTime = parsed.data.endTime;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.minStaffing !== undefined) updateData.minStaffing = parsed.data.minStaffing;
    if (parsed.data.requiresRoster !== undefined) updateData.requiresRoster = parsed.data.requiresRoster;
    if (parsed.data.staffedStations !== undefined) updateData.staffedStations = parsed.data.staffedStations ? JSON.stringify(parsed.data.staffedStations) : null;
    if (parsed.data.signupDeadlineHours !== undefined) updateData.signupDeadlineHours = parsed.data.signupDeadlineHours;
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;

    // Update the configuration
    const config = await prisma.weeklyEventConfiguration.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // If pattern changed (weekday, weeksOn, weeksOff, or startDate), regenerate occurrences
    if (
      parsed.data.weekday !== undefined ||
      parsed.data.weeksOn !== undefined ||
      parsed.data.weeksOff !== undefined ||
      parsed.data.startDate !== undefined
    ) {
      // Delete future occurrences that don't have signups
      await prisma.weeklyEventOccurrence.deleteMany({
        where: {
          configId: Number(id),
          date: {
            gte: new Date(),
          },
          signups: {
            none: {},
          },
        },
      });

      // Regenerate occurrences
      await generateOccurrences(Number(id));
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating weekly event config:", error);
    return NextResponse.json(
      { error: "Failed to update weekly event configuration" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/discord/weekly-events/[id]
 * Delete a weekly event configuration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Get existing config
    const existingConfig = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: Number(id) },
      include: {
        fir: {
          select: { code: true },
        },
      },
    });

    if (!existingConfig) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    // Check permissions
    const isVatgerAdmin = await isVatgerEventleitung(Number(session.user.cid));
    
    if (existingConfig.firId) {
      const hasPermission = await userHasFirPermission(
        Number(session.user.cid),
        existingConfig.fir?.code || "",
        "event.delete"
      );

      if (!hasPermission && !isVatgerAdmin) {
        return NextResponse.json(
          { error: "You don't have permission to delete this weekly event" },
          { status: 403 }
        );
      }
    } else if (!isVatgerAdmin) {
      return NextResponse.json(
        { error: "Only VATGER admins can delete global weekly events" },
        { status: 403 }
      );
    }

    // Delete the configuration (cascades to occurrences, signups, rosters)
    await prisma.weeklyEventConfiguration.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting weekly event config:", error);
    return NextResponse.json(
      { error: "Failed to delete weekly event configuration" },
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
  while (currentDate <= sixMonthsFromNow) {
    // Only add occurrence if we're in the "on" weeks
    if (weekCounter < config.weeksOn) {
      if (currentDate >= today) {
        occurrences.push(new Date(currentDate));
      }
      weekCounter++;
    } else {
      weekCounter++;
      // Skip "off" weeks
      if (weekCounter >= config.weeksOn + config.weeksOff) {
        weekCounter = 0;
      }
    }
    currentDate = addWeeks(currentDate, 1);
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
