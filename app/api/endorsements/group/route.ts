import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { GroupService } from "@/lib/endorsements/groupService";
import { EndorsementQueryParams } from "@/lib/endorsements/types";
import { isVatgerEventleitung } from "@/lib/acl/permissions";
import { eventsWithManageableSignupsWhere } from "@/lib/roster/rosterPermissions";
import { getRatingValue } from "@/utils/ratingToValue";

export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sessionCID = Number(sessionUser.cid);

  try {
    const body = (await req.json()) as EndorsementQueryParams;

    if (!body?.user?.userCID || !body?.event?.airport) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const requestedCID = Number(body.user.userCID);
    if (!Number.isInteger(requestedCID) || requestedCID <= 0) {
      return NextResponse.json({ error: "Invalid CID" }, { status: 400 });
    }

    // Eigene Daten darf jeder abfragen; fremde nur die VATGER-Eventleitung
    // oder, wer Anmeldungen eines Events verwalten darf, für das die Person in
    // dieser FIR angemeldet ist (gewesen) – dieselbe Berechtigung wie beim
    // Bearbeiten der Anmeldung (signups.manage oder Roster-Bearbeitung). Die FIR
    // kommt vom Client; allein das FIR-Recht zu prüfen, ließe jeden mit Rechten
    // in irgendeiner FIR die Freigaben beliebiger CIDs lesen.
    if (requestedCID !== sessionCID) {
      const fir = body.event.fir;
      let allowed = await isVatgerEventleitung(sessionCID);
      if (!allowed && fir) {
        allowed = !!(await prisma.eventSignup.findFirst({
          where: {
            userCID: requestedCID,
            event: await eventsWithManageableSignupsWhere(sessionCID, fir),
          },
          select: { id: true },
        }));
      }
      if (!allowed) {
        return NextResponse.json(
          { error: "Forbidden - You can only query your own endorsement data" },
          { status: 403 }
        );
      }
    }

    // Rating aus der Datenbank, nicht vom Client
    const user = await prisma.user.findUnique({
      where: { cid: requestedCID },
      select: { rating: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await GroupService.getControllerGroup({
      user: { userCID: requestedCID, rating: getRatingValue(user.rating) },
      event: { airport: body.event.airport, fir: body.event.fir },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("group endpoint error", err);
    return NextResponse.json({ error: "Failed to compute group" }, { status: 500 });
  }
}
