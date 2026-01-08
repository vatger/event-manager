import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { weeklyEventConfigService } from "@/lib/discord/weeklyEventConfigService";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
 * Check if user has permission to manage Discord bot configuration
 * Only MAIN_ADMIN or VATGERLeitung can manage Discord bot settings
 */
async function hasDiscordBotPermission(userCid: number): Promise<boolean> {
  const user = await prisma!.user.findUnique({
    where: { cid: userCid },
    include: {
      vatgerLeitung: true,
    },
  });

  if (!user) return false;
  
  // MAIN_ADMIN and VATGERLeitung can manage Discord bot configuration
  return user.role === "MAIN_ADMIN" || !!user.vatgerLeitung;
}

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

    // Check permission
    const hasPermission = await hasDiscordBotPermission(Number(session.user.cid));
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions. Only MAIN_ADMIN or VATGER Leitung can manage Discord bot configuration." },
        { status: 403 }
      );
    }

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
        { error: "Validation error", details: error.issues },
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

    // Check permission
    const hasPermission = await hasDiscordBotPermission(Number(session.user.cid));
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions. Only MAIN_ADMIN or VATGER Leitung can manage Discord bot configuration." },
        { status: 403 }
      );
    }

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
