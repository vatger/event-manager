import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { userHasFirPermission } from "@/lib/acl/permissions";
import { GroupService } from "@/lib/endorsements/groupService";
import { getMinimumStationGroup, canStaffStation } from "@/lib/weeklys/stationUtils";

// Validation schema for weekly event signup
const weeklySignupSchema = z.object({
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/weeklys/[id]/occurrences/[occurrenceId]/signup
 * Get all signups for a specific weekly event occurrence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId } = await params;

    // Check that occurrence belongs to this config
    const occurrence = await prisma.weeklyEventOccurrence.findFirst({
      where: {
        id: Number(occurrenceId),
        configId: Number(id),
      },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Get all signups with user info
    const signups = await prisma.weeklyEventSignup.findMany({
      where: {
        occurrenceId: Number(occurrenceId),
      },
      include: {
        occurrence: {
          select: {
            date: true,
            signupDeadline: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Fetch user details for each signup
    const signupsWithUsers = await Promise.all(
      signups.map(async (signup) => {
        if (!prisma) return { ...signup, user: null };
        
        const user = await prisma.user.findUnique({
          where: { cid: Number(signup.userCID) },
          select: {
            cid: true,
            name: true,
            rating: true,
          },
        });

        return {
          ...signup,
          user,
        };
      })
    );

    return NextResponse.json(signupsWithUsers);
  } catch (error) {
    console.error("Error fetching weekly event signups:", error);
    return NextResponse.json(
      { error: "Failed to fetch signups" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/weeklys/[id]/occurrences/[occurrenceId]/signup
 * Create a new signup for a weekly event occurrence
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId } = await params;
    const body = await req.json();
    const parsed = weeklySignupSchema.safeParse(body);

    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Get occurrence with config
    const occurrence = await prisma.weeklyEventOccurrence.findFirst({
      where: {
        id: Number(occurrenceId),
        configId: Number(id),
      },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Check if this weekly requires roster
    if (!occurrence.config.requiresRoster) {
      return NextResponse.json(
        { error: "This weekly event does not use a roster system. Please book via VATGER Booking." },
        { status: 400 }
      );
    }

    // Get user data for endorsement check
    const user = await prisma.user.findUnique({
      where: { cid: Number(session.user.cid) },
      select: {
        cid: true,
        name: true,
        rating: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse staffed stations from JSON
    let staffedStations: string[] = [];
    try {
      staffedStations = occurrence.config.staffedStations 
        ? (typeof occurrence.config.staffedStations === 'string' 
            ? JSON.parse(occurrence.config.staffedStations) 
            : occurrence.config.staffedStations)
        : [];
    } catch (e) {
      console.error("Error parsing staffedStations:", e);
    }

    // Get user's endorsement group
    let endorsementGroup: string | null = null;
    let restrictions: string[] = [];

    if (staffedStations.length > 0) {
      // Determine which airport to use for endorsement check
      let airports: string[] = [];
      try {
        airports = occurrence.config.airports 
          ? (typeof occurrence.config.airports === 'string' 
              ? JSON.parse(occurrence.config.airports) 
              : occurrence.config.airports)
          : [];
      } catch (e) {
        console.error("Error parsing airports:", e);
      }

      // Use first airport if available
      const checkAirport = airports[0] || 'EDDF'; // Fallback

      try {
        const endorsementData = await GroupService.getControllerGroup({
          user: {
            userCID: Number(user.cid),
            rating: Number(user.rating),
          },
          event: {
            airport: checkAirport,
            fir: occurrence.config.fir?.code,
          },
        });

        endorsementGroup = endorsementData.group;
        restrictions = endorsementData.restrictions || [];

        // Check if user can staff minimum required station
        const minRequiredGroup = getMinimumStationGroup(staffedStations);
        if (minRequiredGroup && !canStaffStation(endorsementGroup, minRequiredGroup)) {
          return NextResponse.json(
            { 
              error: `You are not qualified to staff this event. Minimum required: ${minRequiredGroup}, your qualification: ${endorsementGroup || 'None'}` 
            },
            { status: 403 }
          );
        }

        // If no endorsement group, user cannot control
        if (!endorsementGroup) {
          return NextResponse.json(
            { error: "You do not have the required endorsements to control at this event" },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error("Error checking endorsements:", error);
        // Continue without endorsement check in case of error
      }
    }

    // Check if signup deadline has passed
    if (occurrence.signupDeadline && new Date() > new Date(occurrence.signupDeadline)) {
      // Only allow event team to signup after deadline
      const canManageSignups = occurrence.config.fir
        ? await userHasFirPermission(
            Number(session.user.cid),
            occurrence.config.fir.code,
            "signups.manage"
          )
        : false;

      if (!canManageSignups) {
        return NextResponse.json(
          { error: "Signup deadline has passed" },
          { status: 403 }
        );
      }
    }

    // Check if user is already signed up
    const existingSignup = await prisma.weeklyEventSignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(session.user.cid),
        },
      },
    });

    if (existingSignup) {
      return NextResponse.json(
        { error: "You are already signed up for this event" },
        { status: 400 }
      );
    }

    // Create the signup with endorsement data
    const signup = await prisma.weeklyEventSignup.create({
      data: {
        occurrenceId: Number(occurrenceId),
        userCID: Number(session.user.cid),
        remarks: parsed.data.remarks || null,
        endorsementGroup: endorsementGroup,
        restrictions: restrictions.length > 0 ? JSON.stringify(restrictions) : null,
      },
    });

    return NextResponse.json({ ...signup, user }, { status: 201 });
  } catch (error) {
    console.error("Error creating weekly event signup:", error);
    return NextResponse.json(
      { error: "Failed to create signup" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/weeklys/[id]/occurrences/[occurrenceId]/signup
 * Update current user's signup
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId } = await params;
    const body = await req.json();
    const parsed = weeklySignupSchema.safeParse(body);

    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.flatten().fieldErrors);
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check if signup exists
    const existingSignup = await prisma.weeklyEventSignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(session.user.cid),
        },
      },
    });

    if (!existingSignup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    // Get occurrence to check deadline
    const occurrence = await prisma.weeklyEventOccurrence.findFirst({
      where: {
        id: Number(occurrenceId),
        configId: Number(id),
      },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Check if signup deadline has passed
    if (occurrence.signupDeadline && new Date() > new Date(occurrence.signupDeadline)) {
      const canManageSignups = occurrence.config.fir
        ? await userHasFirPermission(
            Number(session.user.cid),
            occurrence.config.fir.code,
            "signups.manage"
          )
        : false;

      if (!canManageSignups) {
        return NextResponse.json(
          { error: "Cannot update signup after deadline has passed" },
          { status: 403 }
        );
      }
    }

    // Update the signup
    const signup = await prisma.weeklyEventSignup.update({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(session.user.cid),
        },
      },
      data: {
        remarks: parsed.data.remarks || null,
      },
    });

    // Get user info to return with signup
    const user = await prisma.user.findUnique({
      where: { cid: Number(session.user.cid) },
      select: {
        cid: true,
        name: true,
        rating: true,
      },
    });

    return NextResponse.json({ ...signup, user });
  } catch (error) {
    console.error("Error updating weekly event signup:", error);
    return NextResponse.json(
      { error: "Failed to update signup" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/weeklys/[id]/occurrences/[occurrenceId]/signup
 * Delete current user's signup
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId } = await params;

    // Check if signup exists
    const existingSignup = await prisma.weeklyEventSignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(session.user.cid),
        },
      },
    });

    if (!existingSignup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    // Get occurrence to check deadline
    const occurrence = await prisma.weeklyEventOccurrence.findFirst({
      where: {
        id: Number(occurrenceId),
        configId: Number(id),
      },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Check if signup deadline has passed
    if (occurrence.signupDeadline && new Date() > new Date(occurrence.signupDeadline)) {
      const canManageSignups = occurrence.config.fir
        ? await userHasFirPermission(
            Number(session.user.cid),
            occurrence.config.fir.code,
            "signups.manage"
          )
        : false;

      if (!canManageSignups) {
        return NextResponse.json(
          { error: "Cannot delete signup after deadline has passed" },
          { status: 403 }
        );
      }
    }

    // Delete the signup
    await prisma.weeklyEventSignup.delete({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(session.user.cid),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting weekly event signup:", error);
    return NextResponse.json(
      { error: "Failed to delete signup" },
      { status: 500 }
    );
  }
}
