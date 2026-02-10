import { NextRequest, NextResponse } from "next/server";
import { getCachedSignupTable } from "@/lib/cache/signupTableCache";
import { generateSignupCSV, generateExportFilename } from "@/lib/exportUtils";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { hasAdminAccess } from "@/lib/acl/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || !(await hasAdminAccess(Number(user.cid)))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!prisma) return NextResponse.json({ error: "Database not connected" }, { status: 500 });
    
    const { eventId: id } = await params;
    const eventId = parseInt(id);
    console.log(`[Export API] Generating export for event ID: ${id}`);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    // Get selected airport from query params
    const searchParams = request.nextUrl.searchParams;
    const selectedAirport = searchParams.get("airport") || undefined;

    // Fetch event details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get signup data from cache
    const signupData = await getCachedSignupTable(eventId, true);

    // Generate CSV
    const csv = generateSignupCSV(signupData, selectedAirport);
    const filename = generateExportFilename(event.name, selectedAirport);

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[Export API] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
