import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { z } from "zod";
import { GroupKind } from "@prisma/client";
import { getUserWithPermissions } from "@/lib/acl/permissions";
import { CurrentUser } from "@/types/fir";

// Eingabe-Schema: Liste von Operationen
const updateGroupSchema = z.object({
  name: z.string().min(1, "Gruppenname ist erforderlich").optional(),
  description: z.string().optional(),
  kind: z.nativeEnum(GroupKind).optional(),
});

// ───────────────────────────── PATCH ─────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  
  // FIR und Gruppe finden
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir)
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: parseInt(groupId) },
    include: { fir: true }
  });
  
  if (!group)
    return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Prüfen ob Gruppe zur FIR gehört
  if (group.firId !== fir.id)
    return NextResponse.json({ error: "Group does not belong to this FIR" }, { status: 400 });

  const me = await getUserWithPermissions(Number(user.cid)) as CurrentUser | null;
  if (!me) 
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Validierung der Eingabedaten
  const parsed = updateGroupSchema.partial().safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, description, kind } = parsed.data;

  // Sicherheitslogik - gleiche Regeln wie bei POST
  if (me.effectiveLevel == "MAIN_ADMIN" || me.effectiveLevel == "VATGER_LEITUNG") {
    // ok, volle Rechte
  } else if (me.effectiveLevel == "FIR_EVENTLEITER") {
    if (me.fir?.id !== fir.id)
      return NextResponse.json({ error: "Forbidden (wrong FIR)" }, { status: 403 });

    // FIR-Leitung darf keine Leitung/Gruppen bearbeiten
    if (group.kind === GroupKind.FIR_LEITUNG)
      return NextResponse.json(
        { error: "FIR-Leitung darf keine Leitungbearbeiten" },
        { status: 403 }
      );

    // FIR-Leitung darf keine Gruppen in Leitung/Gruppe umwandeln
    if (kind && ([GroupKind.FIR_LEITUNG] as GroupKind[]).includes(kind))
      return NextResponse.json(
        { error: "FIR-Leitung darf keine Leitung erstellen" },
        { status: 403 }
      );
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update der Gruppe
  const updatedGroup = await prisma.group.update({
    where: { id: parseInt(groupId) },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(kind !== undefined && { kind }),
    },
  });

  return NextResponse.json(updatedGroup);
}

// ───────────────────────────── DELETE ─────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir)
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: parseInt(groupId) },
    include: { fir: true }
  });
  
  if (!group)
    return NextResponse.json({ error: "Group not found" }, { status: 404 });

  if (group.firId !== fir.id)
    return NextResponse.json({ error: "Group does not belong to this FIR" }, { status: 400 });

  const me = await getUserWithPermissions(Number(user.cid)) as CurrentUser | null;
  if (!me) 
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Sicherheitslogik - gleiche Regeln wie bei PATCH
  if (me.effectiveLevel == "MAIN_ADMIN" || me.effectiveLevel == "VATGER_LEITUNG") {
    // ok, volle Rechte
  } else if (me.effectiveLevel == "FIR_EVENTLEITER") {
    if (me.fir?.id !== fir.id)
      return NextResponse.json({ error: "Forbidden (wrong FIR)" }, { status: 403 });

    if (group.kind === GroupKind.FIR_LEITUNG)
      return NextResponse.json(
        { error: "FIR-Leitung darf keine Leitungs Gruppe löschen" },
        { status: 403 }
      );
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Gruppe löschen
  await prisma.group.delete({
    where: { id: parseInt(groupId) }
  });

  return NextResponse.json({ success: true });
}
