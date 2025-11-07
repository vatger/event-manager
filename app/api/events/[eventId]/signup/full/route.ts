import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCachedSignupTable } from "@/lib/cache/signupTableCache";
import { SignupTableResponse } from "@/lib/cache/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId: id } = await params;
  const eventId = Number(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  try {
    const data = await getCachedSignupTable(eventId);

    const response: SignupTableResponse = {
      eventId,
      signups: data,
      cached: true,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("SignupTable fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch signup table" }, { status: 500 });
  }
}
