import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isMainAdmin } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    const cid = Number((await params).id);
    if(!cid) return NextResponse.json({ error: "CID required" }, { status: 400 });
    if (isNaN(cid)) return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
    
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


  const currentUser = await prisma.user.findUnique({ where: { cid: Number(session.user.cid) } });
  if (!currentUser || !isMainAdmin(currentUser)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetUser = await prisma.user.findUnique({ where: { cid: cid } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.role === "MAIN_ADMIN") {
    return NextResponse.json({ error: "Cannot remove Main Admin" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { cid: cid },
    data: { role: "USER" },
  });

  return NextResponse.json(updated);
}
