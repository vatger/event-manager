import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
