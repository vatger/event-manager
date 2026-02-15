import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userHasFirPermission } from "@/lib/acl/permissions";
import { invalidateWeeklySignupCache } from "@/lib/cache/weeklySignupCache";

/**
 * PATCH /api/admin/weeklys/[id]/occurrences/[occurrenceId]
 * Update an occurrence (e.g., change date)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, occurrenceId } = await params;
  const configId = parseInt(id);
  const occurrenceIdNum = parseInt(occurrenceId);
  if (isNaN(configId) || isNaN(occurrenceIdNum)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { date } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    // Get the weekly configuration and occurrence
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: configId },
      include: { fir: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Weekly event not found" }, { status: 404 });
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

    // Get the occurrence
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Calculate new signup deadline if applicable
    const newDate = new Date(date);
    let newSignupDeadline: Date | null = null;
    if (config.signupDeadlineHours) {
      newSignupDeadline = new Date(
        newDate.getTime() - config.signupDeadlineHours * 60 * 60 * 1000
      );
    }

    // Update the occurrence
    const updatedOccurrence = await prisma.weeklyEventOccurrence.update({
      where: { id: occurrenceIdNum },
      data: {
        date: newDate,
        signupDeadline: newSignupDeadline,
      },
    });

    // Invalidate cache
    invalidateWeeklySignupCache(occurrenceIdNum);

    return NextResponse.json({
      message: "Occurrence updated successfully",
      occurrence: updatedOccurrence,
    });
  } catch (error) {
    console.error("[PATCH /api/admin/weeklys/[id]/occurrences/[occurrenceId]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/weeklys/[id]/occurrences/[occurrenceId]
 * Delete an occurrence
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, occurrenceId } = await params;
  const configId = parseInt(id);
  const occurrenceIdNum = parseInt(occurrenceId);
  if (isNaN(configId) || isNaN(occurrenceIdNum)) {
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
    const hasPermission = await userHasFirPermission(
      Number(session.user.cid),
      config.fir.code,
      "event.delete"
    );
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the occurrence
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Delete the occurrence (cascades to signups and rosters)
    await prisma.weeklyEventOccurrence.delete({
      where: { id: occurrenceIdNum },
    });

    // Invalidate cache
    invalidateWeeklySignupCache(occurrenceIdNum);

    return NextResponse.json({
      message: "Occurrence deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/admin/weeklys/[id]/occurrences/[occurrenceId]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
