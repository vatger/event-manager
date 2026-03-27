import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAdminAccess, isFIRLead, isVatgerEventleitung } from "@/lib/acl/permissions";

// PATCH update a comment (only the author can edit their own comment)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string; commentId: string }> }
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

    const { commentId: commentIdParam } = await params;
    const commentId = parseInt(commentIdParam);
    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const existing = await prisma.userComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Only the author may edit their own comment
    if (existing.authorCID !== Number(session.user.cid) && !await isVatgerEventleitung(Number(session.user.cid)) && !await isFIRLead(Number(session.user.cid))) {
      return NextResponse.json({ error: "Forbidden – only the author can edit this comment" }, { status: 403 });
    }

    const body = await req.json();
    const { comment } = body;

    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
    }

    const updated = await prisma.userComment.update({
      where: { id: commentId },
      data: { comment: comment.trim() },
      include: {
        author: {
          select: { cid: true, name: true },
        },
      },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error("[PATCH user comment] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE a comment (author can delete their own; admin can delete any)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cid: string; commentId: string }> }
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

    const { commentId: commentIdParam } = await params;
    const commentId = parseInt(commentIdParam);
    if (isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const existing = await prisma.userComment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Only the author may delete their own comment
    if (existing.authorCID !== Number(session.user.cid) && !await isVatgerEventleitung(Number(session.user.cid)) && !await isFIRLead(Number(session.user.cid))) {
      return NextResponse.json({ error: "Forbidden – only the author can delete this comment" }, { status: 403 });
    }

    await prisma.userComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE user comment] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
