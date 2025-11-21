import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserWithPermissions, isVatgerEventleitung } from "@/lib/acl/permissions";

const blockedDateSchema = z.object({
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startDate",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for endDate",
  }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "Invalid time format. Expected HH:mm",
  }).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "Invalid time format. Expected HH:mm",
  }).optional(),
  reason: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// GET: Fetch all blocked dates
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    let where = {};
    
    // Filter by date range if provided
    if (startParam && endParam) {
      const start = new Date(startParam);
      const end = new Date(endParam);
      
      where = {
        OR: [
          {
            startDate: {
              gte: start,
              lte: end,
            },
          },
          {
            endDate: {
              gte: start,
              lte: end,
            },
          },
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: end } },
            ],
          },
        ],
      };
    }

    const blockedDates = await prisma.calendarBlockedDate.findMany({
      where,
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(blockedDates, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new blocked date (VATGER leaders only)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is VATGER event leader
    const isLeader = await isVatgerEventleitung(Number(session.user.cid));
    if (!isLeader) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Only VATGER event leaders can block dates" },
        { status: 403 }
      );
    }

    // Get user with database ID
    const user = await getUserWithPermissions(Number(session.user.cid));
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = blockedDateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const startDate = new Date(parsed.data.startDate);
    const endDate = new Date(parsed.data.endDate);

    if (endDate < startDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    const blockedDate = await prisma.calendarBlockedDate.create({
      data: {
        startDate,
        endDate,
        startTime: parsed.data.startTime || null,
        endTime: parsed.data.endTime || null,
        reason: parsed.data.reason,
        description: parsed.data.description || null,
        createdById: user.id,
      },
    });

    return NextResponse.json(blockedDate, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
