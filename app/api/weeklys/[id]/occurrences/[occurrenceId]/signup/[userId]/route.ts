import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { userHasFirPermission } from "@/lib/acl/permissions";
import { invalidateWeeklySignupCache } from "@/lib/cache/weeklySignupCache";

// Validation schema for weekly event signup
const weeklySignupSchema = z.object({
  remarks: z.string().max(500).optional().nullable(),
});

/**
 * Helper function to check if user can manage signups for this occurrence
 */
async function canManageSignups(
  userCid: number,
  occurrence: any
): Promise<boolean> {
  if (!occurrence.config.fir) return false;
  
  const hasSignupsManage = await userHasFirPermission(
    userCid,
    occurrence.config.fir.code,
    "signups.manage"
  );
  
  const hasEventManage = await userHasFirPermission(
    userCid,
    occurrence.config.fir.code,
    "event.manage"
  );
  
  return hasSignupsManage || hasEventManage;
}

/**
 * GET /api/weeklys/[id]/occurrences/[occurrenceId]/signup/[userId]
 * Get a specific user's signup
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string; userId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId, userId } = await params;

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

    // Check permissions: own signup or has manage permission
    const isOwnSignup = Number(session.user.cid) === Number(userId);
    const hasManagePermission = await canManageSignups(Number(session.user.cid), occurrence);

    if (!isOwnSignup && !hasManagePermission) {
      return NextResponse.json(
        { error: "You don't have permission to view this signup" },
        { status: 403 }
      );
    }

    // Get the signup
    const signup = await prisma.weeklyEventSignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(userId),
        },
      },
      include: {
        user: {
          select: {
            cid: true,
            name: true,
            rating: true,
          },
        },
      },
    });

    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    return NextResponse.json(signup);
  } catch (error) {
    console.error("Error fetching weekly event signup:", error);
    return NextResponse.json(
      { error: "Failed to fetch signup" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/weeklys/[id]/occurrences/[occurrenceId]/signup/[userId]
 * Update a specific user's signup (requires signups.manage or event.manage permission)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string; userId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId, userId } = await params;
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

    // Check permissions: own signup (with deadline check) or has manage permission (no deadline check)
    const isOwnSignup = Number(session.user.cid) === Number(userId);
    const hasManagePermission = await canManageSignups(Number(session.user.cid), occurrence);

    if (!isOwnSignup && !hasManagePermission) {
      return NextResponse.json(
        { error: "You don't have permission to edit this signup" },
        { status: 403 }
      );
    }

    // If it's own signup and user doesn't have manage permission, check deadline
    if (isOwnSignup && !hasManagePermission) {
      if (occurrence.signupDeadline && new Date() > new Date(occurrence.signupDeadline)) {
        return NextResponse.json(
          { error: "Cannot update signup after deadline has passed" },
          { status: 403 }
        );
      }
    }

    // Check if signup exists
    const existingSignup = await prisma.weeklyEventSignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(userId),
        },
      },
    });

    if (!existingSignup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    // Update the signup
    const signup = await prisma.weeklyEventSignup.update({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(userId),
        },
      },
      data: {
        remarks: parsed.data.remarks || null,
      },
    });

    // Invalidate cache so updated signup is reflected
    await invalidateWeeklySignupCache(Number(occurrenceId));

    // Get user info to return with signup
    const user = await prisma.user.findUnique({
      where: { cid: Number(userId) },
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
 * DELETE /api/weeklys/[id]/occurrences/[occurrenceId]/signup/[userId]
 * Delete a specific user's signup (requires signups.manage or event.manage permission)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string; userId: string }> }
) {
  if (!prisma) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, occurrenceId, userId } = await params;

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

    // Check permissions: own signup (with deadline check) or has manage permission (no deadline check)
    const isOwnSignup = Number(session.user.cid) === Number(userId);
    const hasManagePermission = await canManageSignups(Number(session.user.cid), occurrence);

    if (!isOwnSignup && !hasManagePermission) {
      return NextResponse.json(
        { error: "You don't have permission to delete this signup" },
        { status: 403 }
      );
    }

    // If it's own signup and user doesn't have manage permission, check deadline
    if (isOwnSignup && !hasManagePermission) {
      if (occurrence.signupDeadline && new Date() > new Date(occurrence.signupDeadline)) {
        return NextResponse.json(
          { error: "Cannot delete signup after deadline has passed" },
          { status: 403 }
        );
      }
    }

    // Check if signup exists
    const existingSignup = await prisma.weeklyEventSignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(userId),
        },
      },
    });

    if (!existingSignup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    // Delete the signup
    await prisma.weeklyEventSignup.delete({
      where: {
        occurrenceId_userCID: {
          occurrenceId: Number(occurrenceId),
          userCID: Number(userId),
        },
      },
    });

    // Invalidate cache so deleted signup is removed
    await invalidateWeeklySignupCache(Number(occurrenceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting weekly event signup:", error);
    return NextResponse.json(
      { error: "Failed to delete signup" },
      { status: 500 }
    );
  }
}
