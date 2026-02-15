import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/[...nextauth]/auth-options";
import prisma from "@/lib/db";
import { hasPermission } from "@/lib/authentication/auth";

/**
 * POST /api/admin/weeklys/[id]/occurrences/[occurrenceId]/signup-status
 * Change signup status (auto, open, closed)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; occurrenceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configId = parseInt(params.id);
  const occurrenceId = parseInt(params.occurrenceId);
  if (isNaN(configId) || isNaN(occurrenceId)) {
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

    // Get the weekly configuration
    const config = await prisma.weeklyEventConfiguration.findUnique({
      where: { id: configId },
      include: { fir: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Weekly event not found" }, { status: 404 });
    }

    // Check permissions
    if (!hasPermission(session.user, "event.edit", config.fir.icao)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the occurrence
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occurrenceId },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence not found" }, { status: 404 });
    }

    // Update the signup status
    const updatedOccurrence = await prisma.weeklyEventOccurrence.update({
      where: { id: occurrenceId },
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
