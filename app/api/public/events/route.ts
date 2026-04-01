import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/public/events
 * Public endpoint – returns all non-DRAFT events.
 * No authentication required.
 *
 * Optional query param: ?userCID=<number>
 * When provided and the CID matches the authenticated session, each event
 * includes an `isSignedUp` field and the full signup count.
 */
export async function GET(req: Request) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  try {
    // Only trust userCID when it matches the authenticated session
    const { searchParams } = new URL(req.url);
    const userCIDParam = searchParams.get("userCID");
    let trustedUserCID: number | null = null;
    if (userCIDParam) {
      const parsedCID = parseInt(userCIDParam, 10);
      if (!Number.isNaN(parsedCID)) {
        const session = await getServerSession(authOptions);
        if (session?.user?.cid && Number(session.user.cid) === parsedCID) {
          trustedUserCID = parsedCID;
        }
      }
    }

    const events = await prisma.event.findMany({
      where: {
        status: {
          not: "DRAFT",
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        bannerUrl: true,
        bannerVisible: true,
        airports: true,
        startTime: true,
        endTime: true,
        staffedStations: true,
        signupDeadline: true,
        signupSlotMinutes: true,
        status: true,
        firCode: true,
        _count: {
          select: {
            signups: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    // Optionally resolve which events the authenticated user has signed up for
    let signedSet: Set<number> | null = null;
    if (trustedUserCID !== null) {
      const eventIds = events.map((e) => e.id);
      if (eventIds.length > 0) {
        const signups = await prisma.eventSignup.findMany({
          where: {
            userCID: trustedUserCID,
            eventId: { in: eventIds },
            deletedAt: null,
          },
          select: { eventId: true },
        });
        signedSet = new Set(signups.map((s) => s.eventId));
      } else {
        signedSet = new Set();
      }
    }

    const result = events.map(({ _count, bannerVisible, ...event }) => ({
      ...event,
      // Only expose bannerUrl publicly when banner is approved/visible
      bannerUrl: bannerVisible ? event.bannerUrl : null,
      registrations: _count?.signups ?? 0,
      isSignedUp: signedSet !== null ? signedSet.has(event.id) : false,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
