import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // dein Prisma-Client

// GET: Alle Signups eines Users
export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const signups = await prisma.eventSignup.findMany({
      where: { userCID: userId },
      include: {
        event: true, // liefert Event-Infos mit
      },
    });

    return NextResponse.json(signups);
  } catch (error) {
    console.error("Error fetching user signups:", error);
    return NextResponse.json(
      { error: "Failed to fetch user signups" },
      { status: 500 }
    );
  }
}
