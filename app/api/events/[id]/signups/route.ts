import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canUserStaff } from "@/data/canUserStaff"; // dein bestehendes Script


type Position = "DEL" | "GND" | "TWR" | "APP" | "CTR";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) Event mit Airport ermitteln
  const event = await prisma.event.findUnique({
    where: { id: "b18d13af-e76f-4505-8d42-5d2d14e2d3bc" },
    select: { airport: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const icao = event.airport;

  // 2) Alle Signups laden inkl. User-Daten (Rating + Endorsements)
  const signups = await prisma.signup.findMany({
    where: { eventId: "b18d13af-e76f-4505-8d42-5d2d14e2d3bc" },
    include: {
      user: {
        select: {
          id: true,
          cid: true,
          name: true,
          endorsements: {
            select: {
              code: true,
            },
          },
        },
      },
    },
  });

  // 3) canUserStaff auf alle Positionen anwenden
  const enriched = signups.map((signup) => {
    const user = {
      rating: "S3",
      endorsements: signup.user.endorsements.map((e) => ({
        code: e.code,
        type: e.type || undefined,
        validUntil: e.validUntil || undefined,
      })),
    };

    const positions: Record<Position, boolean> = {
      DEL: false,
      GND: false,
      TWR: false,
      APP: false,
      CTR: false,
    };

    (Object.keys(positions) as Position[]).forEach((pos) => {
      positions[pos] = canUserStaff(icao, pos, user).eligible;
    });

    return {
      ...signup,
      ...positions, // Füge Felder wie DEL, GND, TWR, APP, CTR hinzu
    };
  });

  return NextResponse.json(enriched);
}
