import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/weeklys/configs
 * Public endpoint – returns all enabled weekly event configurations.
 * No authentication required.
 */
export async function GET() {
  try {
    const configs = await prisma.weeklyEventConfiguration.findMany({
      where: {
        enabled: true,
      },
      select: {
        id: true,
        firId: true,
        name: true,
        weekday: true,
        weeksOn: true,
        weeksOff: true,
        startDate: true,
        airports: true,
        startTime: true,
        endTime: true,
        description: true,
        bannerUrl: true,
        requiresRoster: true,
        staffedStations: true,
        enabled: true,
        fir: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Error fetching public weekly configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly configurations" },
      { status: 500 }
    );
  }
}
