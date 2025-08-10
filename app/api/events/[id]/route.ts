import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.signup.deleteMany({
    where: { eventId: params.id },
  });

  await prisma.event.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
      const body = await req.json();
  
      const event = await prisma.event.update({
        where: { id: params.id },
        data: {
          name: body.name,
          airport: body.airport,
          startTime: body.startTime ? new Date(body.startTime) : undefined,
          endTime: body.endTime ? new Date(body.endTime) : undefined,
          signupDeadline: body.signupDeadline ? new Date(body.signupDeadline) : undefined,
          googleSheetId: body.googleSheetId,
          status: body.status,
        },
      });
  
      return NextResponse.json(event);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }
  }
