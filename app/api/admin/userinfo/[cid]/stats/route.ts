import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/getSessionUser";
import { hasAdminAccess } from "@/lib/acl/permissions";
import { getUserATCStats, getTopStations } from "@/lib/weeklys/atcSessionStats";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!await hasAdminAccess(Number(user.cid))) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const { cid: cidParam } = await params;
  const cid = Number(cidParam);
  if (isNaN(cid)) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

  try {
    const stats = await getUserATCStats(cid);
    // Return all stations sorted by hours – Top-N filtering and search happen on the client
    return NextResponse.json({ stations: getTopStations(stats) });
  } catch (error) {
    console.error("Error loading ATC stats for CID", cid, error);
    return NextResponse.json({ error: "Failed to load ATC stats" }, { status: 500 });
  }
}
