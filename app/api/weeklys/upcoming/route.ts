import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, addMonths } from "date-fns";

/**
 * GET /api/weeklys/upcoming
 * Get upcoming weekly event occurrences (publicly accessible)
 * Returns occurrences for the next 3 months
 */
export async function GET(request: NextRequest) {
  try {
    const today = startOfDay(new Date());
    const threeMonthsFromNow = addMonths(today, 3);

    const occurrences = await prisma!.weeklyEventOccurrence.findMany({
      where: {
        date: {
          gte: today,
          lte: threeMonthsFromNow,
        },
        config: {
          enabled: true,
        },
      },
      include: {
        config: {
          select: {
            id: true,
            name: true,
            weekday: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(occurrences);
  } catch (error) {
    console.error("Error fetching upcoming weekly events:", error);
    return NextResponse.json(
      { error: "Failed to fetch upcoming weekly events" },
      { status: 500 }
    );
  }
}
