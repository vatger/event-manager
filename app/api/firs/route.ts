import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "MAIN_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const firs = await prisma.fIR.findMany({
    include: {
      groups: true,
      members: true,
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(firs);
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "MAIN_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await req.json();
  const { code, name } = data;

  if (!code || !name)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const exists = await prisma.fIR.findUnique({ where: { code } });
  if (exists)
    return NextResponse.json({ error: "FIR already exists" }, { status: 409 });

  const fir = await prisma.fIR.create({ data: { code, name } });
  return NextResponse.json(fir);
}
