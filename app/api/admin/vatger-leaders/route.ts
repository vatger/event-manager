import { getSessionUser } from "@/lib/getSessionUser";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "MAIN_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const vatgerGroup = await prisma.group.findFirst({
      where: { kind: "GLOBAL_VATGER_LEITUNG" },
      include: {
        members: {
          include: {
            user: {
              select: {
                cid: true,
                name: true,
                rating: true,
              }
            }
          }
        }
      }
    });

    if (!vatgerGroup) {
      return NextResponse.json({ error: "VATGER group not found" }, { status: 404 });
    }

    return NextResponse.json(vatgerGroup.members);
  } catch (error) {
    console.error("Failed to load VATGER leaders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}