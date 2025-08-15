import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import z from "zod";

// --- Validation Schema für Events ---
const eventSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  bannerUrl: z.string().url(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for startTime",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for endTime",
  }),
  airports: z.array(z.string().length(4, "ICAO must be 4 letters")),
  signupDeadline: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid date format for signupDeadline",
    }),
  staffedStations: z.array(z.string()).optional(),
  status: z.enum(["PLANNING", "SIGNUP_OPEN", "PLAN_UPLOADED", "COMPLETED"]).optional(),
});


export async function GET(_: Request, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: Number(params.id) },
    include: { signups: true, documents: true }
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
  const event = await prisma.event.update({
    where: { id: Number(params.id) },
    data: {
        name: parsed.data.name,
        description: parsed.data.description,
        bannerUrl: parsed.data.bannerUrl,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        airports: parsed.data.airports,
        signupDeadline: parsed.data.signupDeadline
          ? new Date(parsed.data.signupDeadline)
          : null,
        staffedStations: parsed.data.staffedStations || [],
        status: parsed.data.status || "PLANNING",
        createdById: parseInt(session.user.id),
      },
  });
  return NextResponse.json(event);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await prisma.event.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ success: true });
}
