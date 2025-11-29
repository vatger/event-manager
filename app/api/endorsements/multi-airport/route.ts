import { NextResponse } from "next/server";
import { GroupService } from "@/lib/endorsements/groupService";
import { MultiAirportEndorsementQueryParams } from "@/lib/endorsements/types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  
  try {
    const body = (await req.json()) as MultiAirportEndorsementQueryParams;

    if (!body?.user?.userCID || typeof body.user.rating !== "number" || !body?.event?.airports || !Array.isArray(body.event.airports)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (body.event.airports.length === 0) {
      return NextResponse.json({ error: "At least one airport is required" }, { status: 400 });
    }

    const result = await GroupService.getMultiAirportEndorsements(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("multi-airport endpoint error", err);
    return NextResponse.json({ error: "Failed to compute multi-airport endorsements" }, { status: 500 });
  }
}
