import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userHasFirPermission } from "@/lib/acl/permissions";
import { sendRosterPublishedNotifications } from "@/lib/weeklys/notificationService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse params
    const { id, occurrenceId } = await params;
    const configId = parseInt(id);
    const occurrenceIdNum = parseInt(occurrenceId);

    if (isNaN(configId) || isNaN(occurrenceIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Parse request body
    const body = await req.json();
    const { published } = body;

    if (typeof published !== "boolean") {
      return NextResponse.json(
        { error: "Invalid published value" },
        { status: 400 }
      );
    }

    // Fetch occurrence with config and FIR
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
      return NextResponse.json(
        { error: "Occurrence not found" },
        { status: 404 }
      );
    }

    if (!occurrence.config.fir) {
      return NextResponse.json({ error: "Configuration or FIR not found" }, { status: 404 });
    }

    // Check permissions
    const hasPermission = await userHasFirPermission(
      Number(session.user.cid),
      occurrence.config.fir.code,
      "event.edit"
    );

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update roster published status
    const updatedOccurrence = await prisma.weeklyEventOccurrence.update({
      where: { id: occurrenceIdNum },
      data: {
        rosterPublished: published,
      },
    });

    // Send notifications if roster is being published (not unpublished)
    if (published) {
      // Send notifications asynchronously (don't wait for completion)
      sendRosterPublishedNotifications(occurrenceIdNum, configId).catch((error) => {
        console.error("Error sending roster notifications:", error);
      });
    }

    return NextResponse.json({
      message: published
        ? "Roster published successfully"
        : "Roster unpublished successfully",
      occurrence: updatedOccurrence,
    });
  } catch (error) {
    console.error("Error publishing roster:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
