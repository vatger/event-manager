import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { userhasAdminAcess } from "@/lib/acl/permissions";

const POSITION_ORDER = ["GNDDEL", "GND", "TWR", "APP", "CTR"];

function getAirportFromPosition(position: string) {
  return position.split("_")[0];
}

function getLevel(position: string) {
  const suffix = position.split("_").pop()!;
  const index = POSITION_ORDER.indexOf(suffix);
  return index === -1 ? 999 : index;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cid: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  
  // Only admins can access this endpoint - check early before processing
  if (!await userhasAdminAcess(Number(user.cid))) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }
  
  const { cid: cidParam } = await params;
  const cid = Number(cidParam);
  if (isNaN(cid)) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }

  try {
    const [endorsements, solos, fams, user] = await Promise.all([
      prisma.trainingEndorsementCache.findMany({ where: { userCID: cid } }),
      prisma.trainingSoloCache.findMany({ where: { userCID: cid } }),
      prisma.trainingFamiliarizationCache.findMany({ where: { userCID: cid } }),
      prisma.user.findUnique({ where: { cid }, select: { rating: true } }),
    ]);

    const groupByAirport = (arr: { position: string }[]) => {
      const grouped: Record<string, string[]> = {};
      arr.forEach((item) => {
        const airport = getAirportFromPosition(item.position);
        if (!grouped[airport]) grouped[airport] = [];
        grouped[airport].push(item.position);
      });

      for (const airport in grouped) {
        grouped[airport].sort(
          (a, b) => getLevel(a) - getLevel(b)
        );
      }
      return grouped;
    };

    const groupedEndorsements = groupByAirport(endorsements);
    const groupedSolos: Record<string, { position: string; expiry: Date }[]> = {};

    solos.forEach((solo) => {
      const airport = getAirportFromPosition(solo.position);
      if (!groupedSolos[airport]) groupedSolos[airport] = [];
      groupedSolos[airport].push({
        position: solo.position,
        expiry: solo.expiry,
      });
    });

    // Familiarizations gruppieren nach FIR
    const groupedFams: Record<string, string[]> = {};
    fams.forEach((f) => {
      if (!groupedFams[f.sectorFir]) groupedFams[f.sectorFir] = [];
      groupedFams[f.sectorFir].push(f.sectorName);
    });

    return NextResponse.json({
      cid,
      rating: user?.rating || null,
      endorsements: groupedEndorsements,
      solos: groupedSolos,
      familiarizations: groupedFams,
    });
  } catch (error) {
    console.error("Error loading user data:", error);
    return NextResponse.json(
      { error: "Failed to load user data" },
      { status: 500 }
    );
  }
}
