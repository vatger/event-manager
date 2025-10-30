import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { z } from "zod";
import { PermissionScope } from "@prisma/client";
import { clearCache } from "@/lib/cache";
import { canManageFir, getUserWithPermissions, isVatgerEventleitung } from "@/lib/acl/permissions";
import { CurrentUser } from "@/types/fir";

// Eingabe-Schema: Liste von Operationen
const patchSchema = z.object({
  operations: z.array(
    z.object({
      action: z.enum(["ADD", "REMOVE"]),
      key: z.string().min(2),
      scope: z.nativeEnum(PermissionScope),
    })
  ),
});

// ───────────────────────────── PATCH ─────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: Number(groupId) },
    select: { id: true, kind: true, firId: true },
  });
  if (!group)
    return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const me = await getUserWithPermissions(Number(user.cid)) as CurrentUser | null
  if(!me) return NextResponse.json({ error: "User not found" }, { status: 404 })
  
    // Jede Operation prüfen
  for (const op of parsed.data.operations) {
    const permission = await prisma.permission.findUnique({
      where: { key: op.key },
    });
    if (!permission)
      return NextResponse.json(
        { error: `Permission not found: ${op.key}` },
        { status: 400 }
      );

    const allowed = await canManageFir(Number(user.cid), fir.code)

    if (!allowed) {
      return NextResponse.json(
        {
          error: `Forbidden to ${op.action} ${permission.key} (${op.scope}) on this group`,
        },
        { status: 403 }
      );
    }

    // Wenn erlaubt → ausführen
    if (op.action === "ADD") {
      await prisma.groupPermission.upsert({
        where: {
          groupId_permissionId_scope: {
            groupId: group.id,
            permissionId: permission.id,
            scope: op.scope,
          },
        },
        update: {},
        create: {
          groupId: group.id,
          permissionId: permission.id,
          scope: op.scope,
        },
      });
    } else {
      await prisma.groupPermission.deleteMany({
        where: {
          groupId: group.id,
          permissionId: permission.id,
          scope: op.scope,
        },
      });
    }
  }
  clearCache()
  return NextResponse.json({ success: true });
}

// ───────────────────────────── DELETE ─────────────────────────────
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ code: string; groupId: string }> }
) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, groupId } = await params;
  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: Number(groupId) },
    select: { id: true, kind: true, firId: true },
  });
  if (!group)
    return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Nur MainAdmins und VATGER-Leitung dürfen Gruppen löschen
  if (await canManageFir(Number(user.cid), fir.code))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.group.delete({ where: { id: group.id } });
  
  clearCache()
  return NextResponse.json({ success: true });
}
