import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

/**
 * GET /api/public/weeklys
 * Public endpoint – returns upcoming weekly event occurrences with FIR info.
 * Accepts optional ?from=YYYY-MM-DD and ?to=YYYY-MM-DD query params.
 * Falls back to the next 3 months when not provided.
 * No authentication required.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const from = fromParam ? new Date(fromParam) : new Date();
    const to = toParam ? new Date(toParam) : addMonths(new Date(), 3);

    const occurrences = await prisma.weeklyEventOccurrence.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
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
            startTime: true,
            endTime: true,
            fir: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(occurrences);
  } catch (error) {
    console.error("Error fetching public weekly events:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly events" },
      { status: 500 }
    );
  }
}
