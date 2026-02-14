import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/weeklys/[id]
 * Get details of a specific weekly event configuration (publicly accessible)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    const { id } = await params;

    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: {
        id: Number(id),
        enabled: true,
      },
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
          take: 10, // Next 10 occurrences
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { error: "Weekly event not found" },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const response = {
      ...config,
      airports: config.airports
        ? typeof config.airports === "string"
          ? JSON.parse(config.airports)
          : config.airports
        : [],
      staffedStations: config.staffedStations
        ? typeof config.staffedStations === "string"
          ? JSON.parse(config.staffedStations)
          : config.staffedStations
        : [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching weekly event:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly event" },
      { status: 500 }
    );
  }
}
