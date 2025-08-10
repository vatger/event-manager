import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // Prisma Client importieren
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

interface SignupRequestBody {
  eventId: string;
  availability: string;
  preferredPosition: string;
  breaks: string;
}

export async function POST(req: Request) {
  try {
    // Session prüfen (optional, falls Anmeldung nur für eingeloggte User)
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SignupRequestBody = await req.json();

    if (!body.eventId || !body.availability || !body.preferredPosition) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Anmeldung speichern
    const signup = await prisma.signup.create({
      data: {
        eventId: body.eventId,
        userCid: session.user?.id as string,
        userName: session.user?.name as string,
        from: body.availability,
        to: "",
        station: body.preferredPosition,
        breaks: body.breaks || "",
        endorsements: ""
      },
    });

    return NextResponse.json(signup, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Failed to create signup" }, { status: 500 });
  }
}
