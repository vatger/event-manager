import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireDepartment } from "@/lib/acl/teamService";
import { canCreateGroup } from "@/lib/acl/teamRules";

const createSchema = z.object({
  name: z.string().trim().min(2, "Der Name braucht mindestens zwei Zeichen").max(80),
  description: z.string().trim().max(190).optional(),
});

/**
 * POST /api/firs/[code]/groups
 * Legt eine Untergruppe an. Die Leitungsgruppe gibt es je FIR genau einmal,
 * sie entsteht nicht über diese Route.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;
  if (!canCreateGroup(ctx.actor, ctx.fir.code)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" },
      { status: 400 }
    );
  }

  const { name, description } = parsed.data;
  const duplicate = await prisma.group.findFirst({
    where: { firId: ctx.fir.id, name },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `Eine Gruppe „${name}“ gibt es in dieser FIR bereits.` },
      { status: 409 }
    );
  }

  const group = await prisma.group.create({
    data: { name, description: description || null, kind: "CUSTOM", firId: ctx.fir.id },
  });

  return NextResponse.json({ id: group.id }, { status: 201 });
}
