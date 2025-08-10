import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const events = await prisma.event.findMany({
    include: { signups: true },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const event = await prisma.event.create({
      data: {
        name: body.name,
        airport: body.airport,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        signupDeadline: new Date(body.signupDeadline),
        googleSheetId: body.googleSheetId,
        createdBy: body.createdBy || "Admin",
        status: "upcoming", // standard
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
