import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/weeklys/[id]/occurrences/[occurrenceId]
 * Get details of a specific weekly event occurrence (publicly accessible)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    const { id, occurrenceId } = await params;

    const occurrence = await prisma.weeklyEventOccurrence.findFirst({
      where: {
        id: Number(occurrenceId),
        configId: Number(id),
      },
      include: {
        config: {
          include: {
            fir: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: "Occurrence not found" },
        { status: 404 }
      );
    }

    // Parse JSON fields from config
    const response = {
      ...occurrence,
      config: {
        ...occurrence.config,
        airports: occurrence.config.airports
          ? typeof occurrence.config.airports === "string"
            ? JSON.parse(occurrence.config.airports)
            : occurrence.config.airports
          : [],
        staffedStations: occurrence.config.staffedStations
          ? typeof occurrence.config.staffedStations === "string"
            ? JSON.parse(occurrence.config.staffedStations)
            : occurrence.config.staffedStations
          : [],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching occurrence:", error);
    return NextResponse.json(
      { error: "Failed to fetch occurrence" },
      { status: 500 }
    );
  }
}
