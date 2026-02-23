import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userHasFirPermission } from "@/lib/acl/permissions";
import { getCachedWeeklySignups } from "@/lib/cache/weeklySignupCache";
import { extractStationGroup, canStaffStation } from "@/lib/weeklys/stationUtils";
import { getUsersHistoryBatch } from "@/lib/weeklys/signupHistory";
import { getUsersATCStatsBatch } from "@/lib/weeklys/atcSessionStats";
import { isS1TwrStation } from "@/lib/stations/stationMetadata";

// GET roster data for occurrence
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, occurrenceId } = await params;
    const configId = parseInt(id);
    const occurrenceIdNum = parseInt(occurrenceId);

    if (isNaN(configId) || isNaN(occurrenceIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Fetch config with FIR
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: configId },
      include: { fir: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (!config.fir) {
      return NextResponse.json({ error: "Configuration or FIR not found" }, { status: 404 });
    }

    // Check permissions
    const hasPermission = await userHasFirPermission(
      Number(session.user.cid),
      config.fir.code,
      "event.edit"
    );

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch occurrence
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
      include: {
        config: true,
      },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Get signups with endorsements (from cache)
    const signupsData = await getCachedWeeklySignups(occurrenceIdNum);

    // Get current roster assignments with user details
    const rosterEntries = await prisma.weeklyEventRoster.findMany({
      where: { occurrenceId: occurrenceIdNum },
      include: {
        occurrence: {
          include: {
            config: true,
          },
        },
      },
    });

    // Fetch user details for each roster entry
    const roster = await Promise.all(
      rosterEntries.map(async (entry: typeof rosterEntries[number]) => {
        const user = await prisma.user.findUnique({
          where: { cid: entry.userCID },
          select: {
            cid: true,
            name: true,
            rating: true,
          },
        });

        return {
          ...entry,
          user: user || null,
        };
      })
    );

    // Parse staffedStations from JSON
    const staffedStations = config.staffedStations 
      ? (typeof config.staffedStations === 'string' 
          ? JSON.parse(config.staffedStations) 
          : config.staffedStations)
      : [];

    // Get historical signup/roster data for all signed-up users (last 3 occurrences)
    const userCIDs = signupsData.map((s) => s.userCID);
    const historyMap = await getUsersHistoryBatch(userCIDs, configId, occurrenceIdNum, 3);

    // Get ATC session statistics for all signed-up users
    const atcStatsMap = await getUsersATCStatsBatch(userCIDs);

    // Convert Map to plain objects for JSON serialization
    const atcStatsWithObjects = new Map<number, any>();
    for (const [cid, stats] of atcStatsMap.entries()) {
      atcStatsWithObjects.set(cid, {
        userCID: stats.userCID,
        stationStats: Object.fromEntries(stats.stationStats),
      });
    }

    // Enrich signups with history data and ATC stats
    const signupsWithHistory = signupsData.map((signup) => ({
      ...signup,
      history: historyMap.get(signup.userCID) || null,
      atcStats: atcStatsWithObjects.get(signup.userCID) || null,
    }));

    return NextResponse.json({
      occurrence,
      config: {
        ...config,
        staffedStations,
      },
      signups: signupsWithHistory,
      roster,
    });
  } catch (error) {
    console.error("[GET roster] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST assign user to station
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, occurrenceId } = await params;
    const configId = parseInt(id);
    const occurrenceIdNum = parseInt(occurrenceId);

    if (isNaN(configId) || isNaN(occurrenceIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { station, userCID } = body;

    if (!station || !userCID) {
      return NextResponse.json(
        { error: "Station and userCID are required" },
        { status: 400 }
      );
    }

    // Fetch config with FIR
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: configId },
      include: { fir: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (!config.fir) {
      return NextResponse.json({ error: "Configuration or FIR not found" }, { status: 404 });
    }

    // Check permissions
    const hasPermission = await userHasFirPermission(
      Number(session.user.cid),
      config.fir.code,
      "event.edit"
    );

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify occurrence exists
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Verify user signed up
    const signup = await prisma.weeklyEventSignup.findFirst({
      where: {
        occurrenceId: occurrenceIdNum,
        userCID: userCID,
      },
    });

    if (!signup) {
      return NextResponse.json(
        { error: "User has not signed up for this occurrence" },
        { status: 400 }
      );
    }

    // Get signups with endorsements to validate
    const signupsData = await getCachedWeeklySignups(occurrenceIdNum);
    const signupWithEndorsement = signupsData.find(s => s.userCID === userCID);

    if (!signupWithEndorsement?.endorsementGroup) {
      return NextResponse.json(
        { error: "Could not determine user endorsement" },
        { status: 400 }
      );
    }

    // Validate endorsement
    const stationGroup = extractStationGroup(station);
    
    // Check if this is an S1 TWR station
    const isS1Twr = await isS1TwrStation(station);
    
    if (!canStaffStation(signupWithEndorsement.endorsementGroup, stationGroup, isS1Twr)) {
      const s1TwrNote = isS1Twr && stationGroup === 'TWR' 
        ? ' (S1 TWR - GND endorsement allowed)' 
        : '';
      return NextResponse.json(
        {
          error: `User endorsement (${signupWithEndorsement.endorsementGroup}) insufficient for station ${station} (requires ${stationGroup}${s1TwrNote})`,
        },
        { status: 400 }
      );
    }

    // Check if station already assigned
    const existingAssignment = await prisma.weeklyEventRoster.findUnique({
      where: {
        occurrenceId_station: {
          occurrenceId: occurrenceIdNum,
          station: station,
        },
      },
    });

    if (existingAssignment) {
      // Update existing assignment
      const updated = await prisma.weeklyEventRoster.update({
        where: { id: existingAssignment.id },
        data: { userCID },
      });
      
      return NextResponse.json({
        message: "Assignment updated successfully",
        roster: updated,
      });
    }

    // Create new assignment
    const rosterEntry = await prisma.weeklyEventRoster.create({
      data: {
        occurrenceId: occurrenceIdNum,
        station,
        userCID,
      },
    });

    return NextResponse.json({
      message: "User assigned successfully",
      roster: rosterEntry,
    });
  } catch (error) {
    console.error("[POST roster] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
