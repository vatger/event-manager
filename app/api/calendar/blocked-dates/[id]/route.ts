import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isVatgerEventleitung } from "@/lib/acl/permissions";

const updateBlockedDateSchema = z.object({
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startDate",
  }).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for endDate",
  }).optional(),
  reason: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

// DELETE: Remove a blocked date (VATGER leaders only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is VATGER event leader
    const isLeader = await isVatgerEventleitung(Number(session.user.cid));
    if (!isLeader) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Only VATGER event leaders can delete blocked dates" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const blockedDateId = parseInt(id);

    if (isNaN(blockedDateId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await prisma.calendarBlockedDate.delete({
      where: { id: blockedDateId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update a blocked date (VATGER leaders only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is VATGER event leader
    const isLeader = await isVatgerEventleitung(Number(session.user.cid));
    if (!isLeader) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Only VATGER event leaders can update blocked dates" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const blockedDateId = parseInt(id);

    if (isNaN(blockedDateId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = updateBlockedDateSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updateData: any = {};
    
    if (parsed.data.startDate) {
      updateData.startDate = new Date(parsed.data.startDate);
    }
    if (parsed.data.endDate) {
      updateData.endDate = new Date(parsed.data.endDate);
    }
    if (parsed.data.reason !== undefined) {
      updateData.reason = parsed.data.reason;
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description;
    }

    // Validate that end date is after start date if both are being updated
    if (updateData.startDate || updateData.endDate) {
      const current = await prisma.calendarBlockedDate.findUnique({
        where: { id: blockedDateId },
      });

      if (!current) {
        return NextResponse.json({ error: "Blocked date not found" }, { status: 404 });
      }

      const finalStartDate = updateData.startDate || current.startDate;
      const finalEndDate = updateData.endDate || current.endDate;

      if (finalEndDate < finalStartDate) {
        return NextResponse.json(
          { error: "End date must be after start date" },
          { status: 400 }
        );
      }
    }

    const blockedDate = await prisma.calendarBlockedDate.update({
      where: { id: blockedDateId },
      data: updateData,
    });

    return NextResponse.json(blockedDate, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
