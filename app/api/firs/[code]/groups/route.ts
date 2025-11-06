import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { z } from "zod";
import { GroupKind } from "@prisma/client";
import { getUserWithPermissions, isVatgerEventleitung } from "@/lib/acl/permissions";
import { CurrentUser } from "@/types/fir";

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

  const me = await getUserWithPermissions(Number(user.cid)) as CurrentUser | null
  if(!me) return NextResponse.json({ error: "User not found" }, { status: 404 })
  // FIR-Leitung darf nur eigene FIR sehen, andere dürfen alles
  const allowed =
    me.effectiveLevel == "MAIN_ADMIN" ||
    me.effectiveLevel === "VATGER_LEITUNG" ||
    (me.effectiveLevel === "FIR_EVENTLEITER" && me.fir?.id === fir.id);

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

  const me = await getUserWithPermissions(Number(user.cid)) as CurrentUser | null
  if(!me) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, description, kind } = parsed.data;

  // Sicherheitslogik:
  // MainAdmin / VATGER-Leitung dürfen alles
  // FIR-Leitung nur Gruppen in eigener FIR und keine Leitung-Gruppen
  if (me.effectiveLevel == "MAIN_ADMIN" || me.effectiveLevel == "VATGER_LEITUNG") {
    // ok, volle Rechte
  } else if (me.effectiveLevel == "FIR_EVENTLEITER") {
    if (me.fir?.id !== fir.id)
      return NextResponse.json({ error: "Forbidden (wrong FIR)" }, { status: 403 });

    if (kind && ([GroupKind.FIR_LEITUNG] as GroupKind[]).includes(kind))
      return NextResponse.json(
        { error: "FIR-Leitung darf keine Leitung erstellen" },
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
