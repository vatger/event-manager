import { NextResponse } from "next/server";
import { getCachedSignupTable } from "@/lib/cache/signupTableCache";

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
    const signups = await getCachedSignupTable(eventId);
    return NextResponse.json(signups); // 👈 Nur das Array
  } catch (err) {
    console.error("Cache API error:", err);
    return NextResponse.json({ error: "Failed to load signups" }, { status: 500 });
  }
}