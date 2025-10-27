import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { z } from "zod";
import { getEffectiveLevel } from "@/lib/acl/policies";
import { GroupKind } from "@prisma/client";

// 🔍 Zod-Schema für Eingaben
const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  kind: z.nativeEnum(GroupKind).optional(), // optional; wird geprüft
});

// ───────────────────────────── GET ─────────────────────────────
export async function GET(
  _: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir)
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const { level, firId: actorFirId } = await getEffectiveLevel(Number(user.cid));

  // FIR-Leitung darf nur eigene FIR sehen, andere dürfen alles
  const allowed =
    level === "MAIN_ADMIN" ||
    level === "VATGER_LEITUNG" ||
    (level === "FIR_LEITUNG" && actorFirId === fir.id);

  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const groups = await prisma.group.findMany({
    where: { firId: fir.id },
    include: {
      members: { include: { user: true } },
      permissions: { include: { permission: true } },
    },
  });

  return NextResponse.json(groups);
}

// ───────────────────────────── POST ─────────────────────────────
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir)
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const { level, firId: actorFirId } = await getEffectiveLevel(Number(user.cid));
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, description, kind } = parsed.data;

  // Sicherheitslogik:
  // MainAdmin / VATGER-Leitung dürfen alles
  // FIR-Leitung nur Gruppen in eigener FIR und keine Leitung/Global-Gruppen
  if (level === "MAIN_ADMIN" || level === "VATGER_LEITUNG") {
    // ok, volle Rechte
  } else if (level === "FIR_LEITUNG") {
    if (actorFirId !== fir.id)
      return NextResponse.json({ error: "Forbidden (wrong FIR)" }, { status: 403 });

    if (kind && ([GroupKind.FIR_LEITUNG, GroupKind.GLOBAL_VATGER_LEITUNG] as GroupKind[]).includes(kind))
      return NextResponse.json(
        { error: "FIR-Leitung darf keine Leitung oder globale Gruppe erstellen" },
        { status: 403 }
      );
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const group = await prisma.group.create({
    data: {
      name,
      description,
      kind: kind ?? GroupKind.CUSTOM,
      firId: fir.id,
    },
  });

  return NextResponse.json(group, { status: 201 });
}
