import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadGroup, releaseFirIfNoGroups, requireDepartment } from "@/lib/acl/teamService";
import { canDeleteGroup, canEditGroup } from "@/lib/acl/teamRules";

type Params = { params: Promise<{ code: string; groupId: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(2, "Der Name braucht mindestens zwei Zeichen").max(80).optional(),
  description: z.string().trim().max(190).nullable().optional(),
});

/**
 * PATCH /api/firs/[code]/groups/[groupId]
 * Name und Beschreibung ändern. Der Typ einer Gruppe ist nicht änderbar.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { code, groupId } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const group = await loadGroup(ctx.fir, groupId);
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
  if (!canEditGroup(ctx.actor, group)) {
    return NextResponse.json(
      { error: "Die Leitungsgruppe verwaltet nur die VATGER-Eventleitung." },
      { status: 403 }
    );
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" },
      { status: 400 }
    );
  }
  const { name, description } = parsed.data;

  if (name && name !== group.name) {
    const duplicate = await prisma.group.findFirst({
      where: { firId: ctx.fir.id, name, id: { not: group.id } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `Eine Gruppe „${name}“ gibt es in dieser FIR bereits.` },
        { status: 409 }
      );
    }
  }

  await prisma.group.update({
    where: { id: group.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/firs/[code]/groups/[groupId]
 * Löscht eine Untergruppe samt Mitgliedschaften und Rechten. Wer dadurch in
 * keiner Gruppe der FIR mehr ist, gehört nicht mehr zum Department.
 */
export async function DELETE(_: Request, { params }: Params) {
  const { code, groupId } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const group = await loadGroup(ctx.fir, groupId);
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
  if (!canDeleteGroup(ctx.actor, group)) {
    return NextResponse.json(
      { error: "Die Leitungsgruppe kann nicht gelöscht werden." },
      { status: 403 }
    );
  }

  const members = await prisma.userGroup.findMany({
    where: { groupId: group.id },
    select: { userCID: true },
  });

  await prisma.group.delete({ where: { id: group.id } });
  await releaseFirIfNoGroups(members.map((m) => m.userCID), ctx.fir.id);

  return NextResponse.json({ success: true });
}
