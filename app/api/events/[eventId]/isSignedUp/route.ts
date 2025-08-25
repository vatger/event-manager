import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ isSignedUp: false });
  }


  const signup = await prisma.signup.findFirst({
    where: {
      eventId: params.id,
      userCid: session.user.id
    }
  });

  return NextResponse.json({ isSignedUp: !!signup });
}
