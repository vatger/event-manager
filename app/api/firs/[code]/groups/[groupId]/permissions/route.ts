import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearCache } from "@/lib/cache";
import { loadGroup, requireDepartment } from "@/lib/acl/teamService";
import { canEditGroupPermissions } from "@/lib/acl/teamRules";
import { PERMISSION_KEYS, getPermission } from "@/lib/acl/catalog";

const updateSchema = z.object({
  permissions: z.array(z.enum(PERMISSION_KEYS)),
});

/**
 * PUT /api/firs/[code]/groups/[groupId]/permissions
 * Ersetzt die Rechte einer Untergruppe durch die übergebene Liste.
 * Die Leitungsgruppe hat fest alle Rechte und lässt sich hier nicht ändern.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const { code, groupId } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const group = await loadGroup(ctx.fir, groupId);
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
  if (!canEditGroupPermissions(ctx.actor, group)) {
    return NextResponse.json(
      { error: "Die Rechte der Leitungsgruppe sind fest und nicht änderbar." },
      { status: 403 }
    );
  }

  // Vollständig prüfen, bevor irgendetwas ersetzt wird
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unbekanntes Recht" }, { status: 400 });
  }
  const keys = Array.from(new Set(parsed.data.permissions));

  // Fehlt ein Katalog-Recht in der Tabelle (Synchronisation noch nicht
  // gelaufen), wird es hier nachgezogen.
  const rows = await Promise.all(
    keys.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: getPermission(key).label },
        select: { id: true },
      })
    )
  );

  // Ersetzen in einer Transaktion: schlägt etwas fehl, bleibt der alte Stand
  await prisma.$transaction([
    prisma.groupPermission.deleteMany({ where: { groupId: group.id } }),
    prisma.groupPermission.createMany({
      data: rows.map((row) => ({ groupId: group.id, permissionId: row.id })),
    }),
  ]);

  clearCache();

  return NextResponse.json({ success: true, permissions: keys });
}
