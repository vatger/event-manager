import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMainAdminCid } from "@/lib/acl/mainAdmins";
import prisma from "@/lib/prisma";
import { getRatingValue } from "@/utils/ratingToValue";
import { buildAirportPolicy } from "@/lib/eligibility/policyService";
import { loadEligibilityData } from "@/lib/eligibility/dataLoader";
import { EligibilityEngine } from "@/lib/eligibility/engine";

/**
 * POST /api/admin/system/endorsement-debug
 * MAIN_ADMIN only – returns the full EligibilityEngine result (including
 * reasonsPerLevel) for a given CID + airport so admins can diagnose
 * eligibility issues in production quickly.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionCID = Number(session.user.cid);
  if (!isMainAdminCid(sessionCID)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { cid?: unknown; airport?: unknown; fir?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const cid = Number(body.cid);
  const airport = typeof body.airport === "string" ? body.airport.trim().toUpperCase() : "";
  const fir = typeof body.fir === "string" ? body.fir.trim().toUpperCase() || undefined : undefined;

  if (!Number.isInteger(cid) || cid <= 0) {
    return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
  }
  if (!airport) {
    return NextResponse.json({ error: "Airport is required" }, { status: 400 });
  }

  // Look up user rating from DB
  const user = await prisma.user.findUnique({
    where: { cid },
    select: { cid: true, name: true, rating: true },
  });

  if (!user) {
    return NextResponse.json({ error: `No user found for CID ${cid}` }, { status: 404 });
  }

  const rating = getRatingValue(user.rating) ?? 0;
  const policy = await buildAirportPolicy(airport, fir);
  const data = await loadEligibilityData(cid, policy);
  const result = EligibilityEngine.evaluate({ userCID: cid, rating }, policy, data);

  return NextResponse.json({
    user: { cid: user.cid, name: user.name, rating: user.rating, ratingValue: rating },
    policy,
    eligibilityData: {
      endorsements: data.endorsements,
      allEndorsements: data.allEndorsements,
      solos: data.solos.map((s) => ({ position: s.position, expiry: s.expiry.toISOString() })),
      relevantSoloPositions: data.relevantSoloPositions,
      famsForFir: data.famsForFir,
      isOnRoster: data.isOnRoster,
      isS1TheoryOnly: data.isS1TheoryOnly,
      t2AfisEndorsements: data.t2AfisEndorsements,
      missingCourses: data.missingCourses,
    },
    result,
  });
}
