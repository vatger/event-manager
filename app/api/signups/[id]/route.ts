import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req: Request, { params }: { params: { eventId: string } }) {
    const session = await getServerSession(authOptions);
  
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    const signup = await prisma.signup.findFirst({
      where: {
        eventId: params.eventId,
        userCid: session.user.id,
      },
    });
  
    if (!signup) {
      return NextResponse.json({ isSignedUp: false });
    }
  
    return NextResponse.json({
      isSignedUp: true,
      signupId: signup.id,
      data: {
        availability: signup.from,
        preferredPositions: signup.station,
        breaks: signup.breaks,
      },
    });
  }

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();

  // Nur der eigene Signup darf geändert werden
  const signup = await prisma.signup.findUnique({ where: { id: params.id } });
  if (!signup || signup.userCid !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.signup.update({
    where: { id: params.id },
    data: {
      from: data.availability,
      breaks: data.breaks,
      station: data.preferredPositions,
    },
  });

  return NextResponse.json(updated);
}
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    const signup = await prisma.signup.findUnique({ where: { id: params.id } });
    if (!signup || signup.userCid !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  
    await prisma.signup.delete({ where: { id: params.id } });
  
    return NextResponse.json({ success: true });
  }
  
