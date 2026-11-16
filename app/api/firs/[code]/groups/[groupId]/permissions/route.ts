// app/api/firs/[code]/groups/[groupId]/permissions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { clearCache } from "@/lib/cache";
import { canManageFir, isVatgerEventleitung } from "@/lib/acl/permissions";
import { z } from "zod";

const updateSchema = z.array(
  z.object({
    permissionId: z.coerce.number().int().positive(),
    scope: z.enum(["OWN_FIR", "ALL"]),
  })
);

/**
 * Lädt FIR und Gruppe und stellt sicher, dass die Gruppe zur FIR aus der URL
 * gehört – sonst ließen sich über die eigene FIR-Adresse fremde Gruppen ändern.
 */
async function loadFirGroup(code: string, groupId: string) {
  const fir = await prisma!.fIR.findUnique({ where: { code: code.toUpperCase() } });
  if (!fir) return { error: "FIR not found" as const };
  const group = await prisma!.group.findUnique({
    where: { id: Number(groupId) },
    select: { id: true, kind: true, firId: true },
  });
  if (!group || group.firId !== fir.id) return { error: "Group not found" as const };
  return { fir, group };
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string; groupId: string }> }) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { code, groupId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const loaded = await loadFirGroup(code, groupId);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: 404 });

  const hasAccess = await canManageFir(Number(session.user.cid), loaded.fir.code);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allPerms = await prisma.permission.findMany({
    include: { groups: { where: { groupId: loaded.group.id } } },
    orderBy: { key: "asc" },
  });

  const formatted = allPerms.map((p) => ({
    id: p.id,
    key: p.key,
    description: p.description,
    assignedScope: p.groups[0]?.scope ?? null,
  }));
  return NextResponse.json(formatted);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const { code, groupId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const loaded = await loadFirGroup(code, groupId);
    if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: 404 });
    const { fir, group } = loaded;

    const cid = Number(session.user.cid);
    const isVatgerLeitung = await isVatgerEventleitung(cid);
    const hasAccess = await canManageFir(cid, fir.code);

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Die Rechte der Leitungsgruppe ändert nur die VATGER-Eventleitung –
    // sonst könnte sich die FIR-Leitung selbst Rechte geben oder nehmen.
    if (group.kind === "FIR_LEITUNG" && !isVatgerLeitung) {
      return NextResponse.json(
        { error: "Die Leitungsgruppe verwaltet nur die VATGER-Eventleitung" },
        { status: 403 }
      );
    }

    // Vollständig prüfen, bevor irgendetwas gelöscht wird
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    // Doppelte Einträge je Recht zusammenfassen
    const updates = Array.from(
      new Map(parsed.data.map((u) => [u.permissionId, u])).values()
    );

    if (updates.some((u) => u.scope === "ALL") && !isVatgerLeitung) {
      return NextResponse.json(
        { error: "Insufficient permissions for ALL scope" },
        { status: 403 }
      );
    }

    const known = await prisma.permission.count({
      where: { id: { in: updates.map((u) => u.permissionId) } },
    });
    if (known !== updates.length) {
      return NextResponse.json({ error: "Unknown permission" }, { status: 400 });
    }

    // Ersetzen in einer Transaktion: schlägt etwas fehl, bleibt der alte Stand
    await prisma.$transaction([
      prisma.groupPermission.deleteMany({ where: { groupId: group.id } }),
      prisma.groupPermission.createMany({
        data: updates.map((u) => ({
          groupId: group.id,
          permissionId: u.permissionId,
          scope: u.scope,
        })),
      }),
    ]);

    clearCache();

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} permissions for group ${group.id}`,
    });
  } catch (error) {
    console.error("❌ PATCH permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
