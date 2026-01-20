import { NextResponse } from "next/server";
import { GroupService } from "@/lib/endorsements/groupService";
import { EndorsementQueryParams } from "@/lib/endorsements/types";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  
  try {
    const body = (await req.json()) as EndorsementQueryParams;

    if (!body?.user?.userCID || typeof body.user.rating !== "number" || !body?.event?.airport) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Security check: Users can only query their own data, unless they are admins
    const requestedCID = body.user.userCID;
    const sessionCID = Number(session.user.cid);
    
    if (requestedCID !== sessionCID && !isAdmin(session.user)) {
      return NextResponse.json({ 
        error: "Forbidden - You can only query your own endorsement data" 
      }, { status: 403 });
    }

    const result = await GroupService.getControllerGroup(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("group endpoint error", err);
    return NextResponse.json({ error: "Failed to compute group" }, { status: 500 });
  }
}

