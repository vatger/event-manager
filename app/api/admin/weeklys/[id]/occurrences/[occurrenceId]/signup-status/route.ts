import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userCanManageWeekly } from "@/lib/acl/permissions";

/**
 * POST /api/admin/weeklys/[id]/occurrences/[occurrenceId]/signup-status
 * Change signup status (auto, open, closed)
 */
export async function POST(
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
    const { status } = body;

    if (!status || !["auto", "open", "closed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'auto', 'open', or 'closed'" },
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

    // Get the occurrence
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Update the signup status
    const updatedOccurrence = await prisma.weeklyEventOccurrence.update({
      where: { id: occurrenceIdNum },
      data: { signupStatus: status },
    });

    return NextResponse.json({
      message: "Signup status updated successfully",
      occurrence: updatedOccurrence,
    });
  } catch (error) {
    console.error("[POST /api/admin/weeklys/[id]/occurrences/[occurrenceId]/signup-status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
