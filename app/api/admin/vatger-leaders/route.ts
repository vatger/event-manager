import { getSessionUser } from "@/lib/getSessionUser";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "MAIN_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const leaders = await prisma.vATGERLeitung.findMany({
      include: {
        user: {
          select: {
            cid: true,
            name: true,
            rating: true,
          },
        },
      },
    });

    if (!leaders) {
      return NextResponse.json({ error: "VATGER Table not found" }, { status: 404 });
    }

    return NextResponse.json(leaders);

  } catch (error) {
    console.error("Failed to load VATGER leaders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}