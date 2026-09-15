import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userCanManageWeekly } from "@/lib/acl/permissions";

// DELETE unassign user from station
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string; rosterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, occurrenceId, rosterId } = await params;
    const configId = parseInt(id);
    const occurrenceIdNum = parseInt(occurrenceId);
    const rosterIdNum = parseInt(rosterId);

    if (isNaN(configId) || isNaN(occurrenceIdNum) || isNaN(rosterIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Check permissions (FIR-level OR weekly-manager)
    const hasPermission = await userCanManageWeekly(
      Number(session.user.cid),
      configId
    );

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify roster entry exists and belongs to this occurrence
    const rosterEntry = await prisma.weeklyEventRoster.findUnique({
      where: { id: rosterIdNum },
    });

    if (!rosterEntry || rosterEntry.occurrenceId !== occurrenceIdNum) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    // Delete the roster entry
    await prisma.weeklyEventRoster.delete({
      where: { id: rosterIdNum },
    });

    return NextResponse.json({
      message: "User unassigned successfully",
    });
  } catch (error) {
    console.error("[DELETE roster entry] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH update assignment type for a roster entry
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string; rosterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, occurrenceId, rosterId } = await params;
    const configId = parseInt(id);
    const occurrenceIdNum = parseInt(occurrenceId);
    const rosterIdNum = parseInt(rosterId);

    if (isNaN(configId) || isNaN(occurrenceIdNum) || isNaN(rosterIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { assignmentType } = body;

    const validTypes = ["normal", "cpt", "training"];
    if (!assignmentType || !validTypes.includes(assignmentType)) {
      return NextResponse.json(
        { error: "Invalid assignmentType. Must be one of: normal, cpt, training" },
        { status: 400 }
      );
    }

    // Check permissions (FIR-level OR weekly-manager)
    const hasPermission = await userCanManageWeekly(
      Number(session.user.cid),
      configId
    );

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify roster entry exists and belongs to this occurrence
    const rosterEntry = await prisma.weeklyEventRoster.findUnique({
      where: { id: rosterIdNum },
    });

    if (!rosterEntry || rosterEntry.occurrenceId !== occurrenceIdNum) {
      return NextResponse.json({ error: "Roster entry not found" }, { status: 404 });
    }

    // Update the assignment type
    const updated = await prisma.weeklyEventRoster.update({
      where: { id: rosterIdNum },
      data: { assignmentType },
    });

    return NextResponse.json({
      message: "Assignment type updated successfully",
      roster: updated,
    });
  } catch (error) {
    console.error("[PATCH roster entry] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
