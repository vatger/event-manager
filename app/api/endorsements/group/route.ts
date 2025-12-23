import { NextResponse } from "next/server";
import { GroupService } from "@/lib/endorsements/groupService";
import { EndorsementQueryParams } from "@/lib/endorsements/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  
  try {
    const body = (await req.json()) as EndorsementQueryParams;

    if (!body?.user?.userCID || typeof body.user.rating !== "number" || !body?.event?.airport) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await GroupService.getControllerGroup(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("group endpoint error", err);
    return NextResponse.json({ error: "Failed to compute group" }, { status: 500 });
  }
}

