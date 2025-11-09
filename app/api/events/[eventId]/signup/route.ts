import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isVatgerEventleitung, userHasFirPermission } from "@/lib/acl/permissions";
import { invalidateSignupTable } from "@/lib/cache/signupTableCache";
import { invalidateCache } from "@/lib/cache/cacheManager";

// GET: alle Signups für ein Event
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const {eventId} = await params
  const eventid = parseInt( eventId, 10);

  try {
    const signups = await prisma.eventSignup.findMany({
      where: { eventId: eventid },
      include: { user: true }, // damit du Userdaten mitbekommst
    });

    return NextResponse.json(signups);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Laden der Signups" }, { status: 500 });
  }
}

// POST: neuen Signup anlegen
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const {eventId} = await params
  const session = await getServerSession(authOptions);
  if (!session || session.user.rating == "OBS") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventid = parseInt(eventId, 10);
  const body = await req.json();

  const eventdata = await prisma.event.findUnique({where: {id: Number(eventid)}})
  if(!eventdata) return NextResponse.json({error: "Das Event existiert nicht mehr"}, {status: 500})
  
  const isAdmin = await userHasFirPermission(Number(session.user.cid), eventdata.firCode!, "signups.manage")

  if(eventdata.status !== "SIGNUP_OPEN" && !isAdmin && !(await isVatgerEventleitung(Number(session.user.cid)))) 
    return NextResponse.json({error: "Die Anmeldung dieses Events ist geschlossen"}, {status: 500})

  try {
    const targetCID = isAdmin && body.userCID ? Number(body.userCID) : Number(session.user.id);

    let user = await prisma.user.findUnique({ where: { cid: targetCID } });
    let usercreated = false
    if (!user) {
      user = await prisma.user.create({
        data: {
          cid: targetCID,
          name: "Unbekannt",
          rating: "OBS", // oder ein Default-Wert
        },
      });
      usercreated = true
    }

    const signup = await prisma.eventSignup.create({
      data: {
        eventId: eventid,
        userCID: targetCID,
        availability: body.availability ?? [],
        breakrequests: body.breakrequests ?? null,
        preferredStations: body.preferredStations ?? null,
        remarks: body.remarks ?? null,
      },
    });

    await invalidateSignupTable(eventid)
    return NextResponse.json({signup, usercreated});
  } catch (err) {
    console.error("Error", err);
    return NextResponse.json({ error: "Fehler beim Erstellen des Signups" }, { status: 500 });
  }
}
