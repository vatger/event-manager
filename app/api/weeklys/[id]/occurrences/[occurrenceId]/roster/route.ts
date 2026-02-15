import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCachedWeeklySignups } from "@/lib/cache/weeklySignupCache";

// GET public roster view
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  try {
    const { id, occurrenceId } = await params;
    const configId = parseInt(id);
    const occurrenceIdNum = parseInt(occurrenceId);

    if (isNaN(configId) || isNaN(occurrenceIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Fetch occurrence
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Only return roster if published
    if (!occurrence.rosterPublished) {
      return NextResponse.json({ error: "Roster not published" }, { status: 404 });
    }

    // Get roster assignments
    const roster = await prisma.weeklyEventRoster.findMany({
      where: { occurrenceId: occurrenceIdNum },
      orderBy: { station: "asc" },
    });

    // Get user details and endorsements for assigned users
    const signupsData = await getCachedWeeklySignups(occurrenceIdNum);
    
    // Enhance roster with user info
    const enhancedRoster = roster.map(r => {
      const signup = signupsData.find(s => s.userCID === r.userCID);
      return {
        ...r,
        user: signup?.user || null,
        endorsementGroup: signup?.endorsementGroup || null,
        restrictions: signup?.restrictions || [],
      };
    });

    // Parse staffedStations from JSON
    const staffedStations = occurrence.config.staffedStations 
      ? (typeof occurrence.config.staffedStations === 'string' 
          ? JSON.parse(occurrence.config.staffedStations) 
          : occurrence.config.staffedStations)
      : [];

    return NextResponse.json({
      occurrence,
      config: {
        ...occurrence.config,
        staffedStations,
      },
      roster: enhancedRoster,
    });
  } catch (error) {
    console.error("[GET public roster] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
