import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/events
 * Public endpoint – returns all non-DRAFT events.
 * No authentication required.
 */
export async function GET() {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  try {
    const events = await prisma.event.findMany({
      where: {
        status: {
          not: "DRAFT",
        },
      },
      select: {
        id: true,
        name: true,
        startTime: true,
        endTime: true,
        firCode: true,
        status: true,
        bannerUrl: true,
        airports: true,
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json(events, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
