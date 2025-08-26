import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// GET: alle Signups für ein Event
export async function GET(req: Request, { params }: { params: { eventId: string } }) {
  const eventId = parseInt(params.eventId, 10);

  try {
    const signups = await prisma.eventSignup.findMany({
      where: { eventId },
      include: { user: true }, // damit du Userdaten mitbekommst
    });

    return NextResponse.json(signups);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Laden der Signups" }, { status: 500 });
  }
}

// POST: neuen Signup anlegen
export async function POST(req: Request, { params }: { params: { eventId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventId = parseInt(params.eventId, 10);
  const body = await req.json();

  const eventdata = await prisma.event.findUnique({where: {id: Number(eventId)}})
  if(!eventdata) return NextResponse.json({error: "Das Event existiert nicht mehr"}, {status: 500})
  if(eventdata.status !== "SIGNUP_OPEN") return NextResponse.json({error: "Die Anmeldung dieses Events ist geschlossen"}, {status: 500})

  try {
    const signup = await prisma.eventSignup.create({
      data: {
        eventId,
        userCID: parseInt(session.user.id), // user aus Session
        availability: body.availability ?? [],
        endorsement: body.endorsement ?? null,
        breakrequests: body.breakrequests ?? null,
        preferredStations: body.preferredStations ?? null,
        remarks: body.remarks ?? null,
      },
    });

    return NextResponse.json(signup);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Erstellen des Signups" }, { status: 500 });
  }
}
