import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userHasFirPermission } from "@/lib/acl/permissions";

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
