import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/[...nextauth]/auth-options";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/authentication/auth";

/**
 * GET /api/admin/weeklys/[id]/occurrences
 * List all occurrences for a weekly event configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configId = parseInt(params.id);
  if (isNaN(configId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    // Get the weekly configuration
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: configId },
      include: { fir: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Weekly event not found" }, { status: 404 });
    }

    // Check permissions
    if (!hasPermission(session.user, "event.edit", config.fir.icao)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all occurrences with signup counts
    const occurrences = await prisma.weeklyEventOccurrence.findMany({
      where: { configId },
      include: {
        _count: {
          select: {
            signups: true,
          },
        },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ occurrences });
  } catch (error) {
    console.error("[GET /api/admin/weeklys/[id]/occurrences] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
