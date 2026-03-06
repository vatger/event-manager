import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userCanManageWeekly } from "@/lib/acl/permissions";

/**
 * POST /api/admin/weeklys/[id]/occurrences/[occurrenceId]/roster/schedule-publish
 * Toggle the "Ready for Takeoff" scheduled publish flag.
 * When enabled, the roster is automatically published when the signup deadline passes.
 */
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
    const { scheduled } = body;

    if (typeof scheduled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid scheduled value" },
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

    // Fetch occurrence with config and FIR
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceIdNum },
      include: {
        config: {
          include: { fir: true },
        },
      },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }
    if (occurrence.rosterPublished && scheduled) {
      return NextResponse.json(
        { error: "Roster is already published" },
        { status: 400 }
      );
    }

    // Update the scheduled publish flag
    const updated = await prisma.weeklyEventOccurrence.update({
      where: { id: occurrenceIdNum },
      data: { rosterScheduledPublish: scheduled },
    });

    return NextResponse.json({
      message: scheduled
        ? "Roster scheduled for auto-publish after signup deadline"
        : "Scheduled publish cancelled",
      occurrence: updated,
    });
  } catch (error) {
    console.error("[POST schedule-publish] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
