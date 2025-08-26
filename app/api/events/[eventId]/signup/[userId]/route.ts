import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";


// GET: einzelnes Signup holen
export async function GET(req: Request, { params }: { params: { eventId: string, userId: string } }) {
  const { eventId, userId } = params;

  try {
    const signup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userCID: {
          eventId: parseInt(eventId, 10),
          userCID: parseInt(userId, 10),
        },
      },
    });

    if (!signup) {
      return NextResponse.json({ error: "Signup nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(signup);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Abrufen" }, { status: 500 });
  }
}

// PUT: Signup aktualisieren
export async function PUT(req: Request, { params }: { params: { eventId: string, userId: string } }) {
  const { eventId, userId } = params;
  const body = await req.json();
  const session = await getServerSession(authOptions);
  const eventdata = await prisma.event.findUnique({where: {id: Number(eventId)}})
  if (!eventdata) return NextResponse.json({error: "Das Event existiert nicht mehr"}, {status: 500})
  if(session.role !== "ADMIN" && eventdata.status !== "SIGNUP_OPEN") return NextResponse.json({error: "Die Anmeldung dieses Events ist geschlossen - Bitte wende dich an das Eventteam"}, {status: 500}) 

  try {
    const updated = await prisma.eventSignup.update({
      where: {
        eventId_userCID: {
          eventId: parseInt(eventId, 10),
          userCID: parseInt(userId, 10),
        },
      },
      data: {
        availability: body.availability,
        endorsement: body.endorsement,
        breakrequests: body.breakrequests,
        preferredStations: body.preferredStations,
        remarks: body.remarks,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Updaten" }, { status: 500 });
  }
}

// DELETE: Signup löschen
export async function DELETE(req: Request, { params }: { params: { eventId: string, userId: string } }) {
  const { eventId, userId } = params;
  const session = await getServerSession(authOptions);
  const eventdata = await prisma.event.findUnique({where: {id: Number(eventId)}})
  if (!eventdata) return NextResponse.json({error: "Das Event existiert nicht mehr"}, {status: 500})
  if(session.role !== "ADMIN" && eventdata.status !== "SIGNUP_OPEN") return NextResponse.json({error: "Die Anmeldung dieses Events ist geschlossen - Bitte wende dich an das Eventteam"}, {status: 500}) 

  try {
    await prisma.eventSignup.delete({
      where: {
        eventId_userCID: {
          eventId: parseInt(eventId, 10),
          userCID: parseInt(userId, 10),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
