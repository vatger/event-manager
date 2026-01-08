import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { weeklyEventConfigService } from "@/lib/discord/weeklyEventConfigService";
import { z } from "zod";

// Validation schema for creating/updating weekly event configurations
const createWeeklyEventSchema = z.object({
  firId: z.number().optional(),
  name: z.string().min(1, "Name is required"),
  weekday: z.number().min(0).max(6),
  weeksOn: z.number().min(1),
  weeksOff: z.number().min(0),
  startDate: z.string().datetime().or(z.date()),
  checkDaysAhead: z.number().min(1).optional(),
  discordChannelId: z.string().optional(),
  discordRoleId: z.string().optional(),
  requiredStaffing: z.record(z.string(), z.number()).optional(),
  enabled: z.boolean().optional(),
});

const updateWeeklyEventSchema = createWeeklyEventSchema.partial();

/**
 * GET /api/admin/discord/weekly-events
 * Get all weekly event configurations (optionally filtered by FIR)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const firId = searchParams.get("firId");

    const configs = await weeklyEventConfigService.getAll(
      firId ? parseInt(firId) : undefined
    );

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching weekly event configurations:", error);
    return NextResponse.json(
      { error: "Failed to fetch configurations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/discord/weekly-events
 * Create a new weekly event configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add permission check for discord configuration management

    const body = await request.json();
    const validatedData = createWeeklyEventSchema.parse(body);

    const config = await weeklyEventConfigService.create(validatedData);

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating weekly event configuration:", error);
    return NextResponse.json(
      { error: "Failed to create configuration" },
      { status: 500 }
    );
  }
}
