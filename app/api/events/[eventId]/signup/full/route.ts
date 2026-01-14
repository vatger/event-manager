import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCachedSignupTable, getLastUpdateTimestamp } from "@/lib/cache/signupTableCache";
import { SignupTableResponse } from "@/lib/cache/types";
import { getSessionUser } from "@/lib/getSessionUser";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { eventId: id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  try {
    // Check if force refresh is requested
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    const data = await getCachedSignupTable(eventId, forceRefresh);
    const lastUpdate = getLastUpdateTimestamp(eventId);

    const response: SignupTableResponse = {
      eventId,
      signups: data,
      cached: !forceRefresh,
      lastUpdate, // Include timestamp for client-side cache busting
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("SignupTable fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch signup table" }, { status: 500 });
  }
}
