import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkOccurrenceInMyVatsim } from "@/lib/weeklys/myVatsimService";
import { userHasFirPermission } from "@/lib/acl/permissions";

/**
 * POST /api/admin/weeklys/[id]/occurrences/[occurrenceId]/check-myvatsim
 * Manually check if occurrence is registered on myVATSIM
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, occurrenceId } = await params;
    const configId = parseInt(id);
    const occId = parseInt(occurrenceId);

    // Fetch occurrence with config
    const occurrence = await prisma.weeklyEventOccurrence.findUnique({
      where: { id: occId },
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

    if (occurrence.configId !== configId) {
      return NextResponse.json({ error: "Occurrence does not belong to this config" }, { status: 400 });
    }

    // Check permissions
    if (occurrence.config.fir) {
      const hasPermission = await userHasFirPermission(
        parseInt(session.user.cid),
        occurrence.config.fir.code,
        "events.manage"
      );

      if (!hasPermission) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    // Check myVATSIM
    console.log(`[myVATSIM Check] Checking occurrence ${occId}: ${occurrence.config.name} on ${occurrence.date}`);
    const isRegistered = await checkOccurrenceInMyVatsim(
      occurrence.config.name,
      occurrence.date
    );

    // Update occurrence
    await prisma.weeklyEventOccurrence.update({
      where: { id: occId },
      data: {
        myVatsimChecked: true,
        myVatsimRegistered: isRegistered,
      },
    });

    console.log(`[myVATSIM Check] Result for occurrence ${occId}: ${isRegistered ? "registered" : "not registered"}`);

    return NextResponse.json({
      checked: true,
      registered: isRegistered,
    });
  } catch (error) {
    console.error("[myVATSIM Check] Error:", error);
    return NextResponse.json(
      { error: "Failed to check myVATSIM" },
      { status: 500 }
    );
  }
}
