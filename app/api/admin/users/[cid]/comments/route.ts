import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAdminAccess } from "@/lib/acl/permissions";

// GET all comments for a user
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized = await hasAdminAccess(Number(session.user.cid));
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { cid: cidParam } = await params;
    const userCID = parseInt(cidParam);
    if (isNaN(userCID)) {
      return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
    }

    const comments = await prisma.userComment.findMany({
      where: { userCID },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { cid: true, name: true },
        },
      },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[GET user comments] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create a new comment for a user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authorized = await hasAdminAccess(Number(session.user.cid));
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { cid: cidParam } = await params;
    const userCID = parseInt(cidParam);
    if (isNaN(userCID)) {
      return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
    }

    const body = await req.json();
    const { comment } = body;

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
    }

    // Verify the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { cid: userCID },
      select: { cid: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const created = await prisma.userComment.create({
      data: {
        userCID,
        authorCID: Number(session.user.cid),
        comment: comment.trim(),
      },
      include: {
        author: {
          select: { cid: true, name: true },
        },
      },
    });

    return NextResponse.json({ comment: created }, { status: 201 });
  } catch (error) {
    console.error("[POST user comment] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
