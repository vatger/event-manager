import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const signups = await prisma.signup.findMany({
    where: { eventId: params.id },
    include: { user: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(signups);
}
