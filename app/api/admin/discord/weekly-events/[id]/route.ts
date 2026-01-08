import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { weeklyEventConfigService } from "@/lib/discord/weeklyEventConfigService";
import { z } from "zod";

const updateWeeklyEventSchema = z.object({
  firId: z.number().optional(),
  name: z.string().min(1).optional(),
  weekday: z.number().min(0).max(6).optional(),
  weeksOn: z.number().min(1).optional(),
  weeksOff: z.number().min(0).optional(),
  startDate: z.string().datetime().or(z.date()).optional(),
  checkDaysAhead: z.number().min(1).optional(),
  discordChannelId: z.string().optional(),
  discordRoleId: z.string().optional(),
  requiredStaffing: z.record(z.string(), z.number()).optional(),
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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const config = await weeklyEventConfigService.getById(parseInt(id));

    if (!config) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching weekly event configuration:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/discord/weekly-events/[id]
 * Update a weekly event configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add permission check for discord configuration management

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateWeeklyEventSchema.parse(body);

    const config = await weeklyEventConfigService.update(
      parseInt(id),
      validatedData
    );

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating weekly event configuration:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: Add permission check for discord configuration management

    const { id } = await params;
    await weeklyEventConfigService.delete(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting weekly event configuration:", error);
    return NextResponse.json(
      { error: "Failed to delete configuration" },
      { status: 500 }
    );
  }
}
