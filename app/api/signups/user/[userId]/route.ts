import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // dein Prisma-Client
import { getSessionUser } from "@/lib/getSessionUser";

// GET: Alle Signups eines Users
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { userId} = await params
  try {
    const userid = parseInt(userId, 10);
    if (isNaN(userid)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const signups = await prisma.eventSignup.findMany({
      where: { userCID: userid },
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
