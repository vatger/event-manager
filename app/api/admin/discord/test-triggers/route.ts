import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runMyVatsimEventCheck } from "@/discord-bot/jobs/myVatsimCheck.job";
import { runStaffingCheck } from "@/discord-bot/jobs/staffingCheck.job";
import { prisma } from "@/lib/prisma";

/**
 * Manual trigger endpoints for testing Discord bot functionality
 * Only available in development/testing phase
 * Requires MAIN_ADMIN or VATGERLeitung permissions
 */

async function hasDiscordBotPermission(userCid: number): Promise<boolean> {
  const user = await prisma!.user.findUnique({
    where: { cid: userCid },
    include: {
      vatgerLeitung: true,
    },
  });

  if (!user) return false;
  
  return user.role === "MAIN_ADMIN" || !!user.vatgerLeitung;
}

/**
 * POST /api/admin/discord/test-triggers
 * Manually trigger Discord bot checks for testing
 * 
 * Body: { "action": "myVatsim" | "staffing" | "both" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const hasPermission = await hasDiscordBotPermission(session.user.cid);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions. Only MAIN_ADMIN or VATGER Leitung can trigger Discord bot tests." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action || !["myVatsim", "staffing", "both"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'myVatsim', 'staffing', or 'both'" },
        { status: 400 }
      );
    }

    const results: any = {
      triggered: [],
      results: {},
    };

    // Trigger myVATSIM check
    if (action === "myVatsim" || action === "both") {
      console.log("[Test Trigger] Running myVATSIM event check...");
      try {
        const myVatsimResult = await runMyVatsimEventCheck();
        results.triggered.push("myVatsim");
        results.results.myVatsim = myVatsimResult;
      } catch (error) {
        console.error("[Test Trigger] myVATSIM check failed:", error);
        results.results.myVatsim = {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Trigger staffing check
    if (action === "staffing" || action === "both") {
      console.log("[Test Trigger] Running staffing check...");
      try {
        const staffingResult = await runStaffingCheck();
        results.triggered.push("staffing");
        results.results.staffing = staffingResult;
      } catch (error) {
        console.error("[Test Trigger] Staffing check failed:", error);
        results.results.staffing = {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Test triggers executed",
      ...results,
    });
  } catch (error) {
    console.error("Error triggering Discord bot tests:", error);
    return NextResponse.json(
      { error: "Failed to trigger tests" },
      { status: 500 }
    );
  }
}
