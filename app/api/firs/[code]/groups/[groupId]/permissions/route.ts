// app/api/firs/[code]/groups/[groupId]/permissions/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";
import { clearCache } from "@/lib/cache";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string; groupId: string }> }) {
  const {code, groupId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fir = await prisma.fIR.findUnique({ where: { code: code } });
  if (!fir) return NextResponse.json({ error: "FIR not found" }, { status: 404 });

  const hasAccess =
    session.user.role === "MAIN_ADMIN" ||
    (await userHasPermission(Number(session.user.cid), "fir.manage", fir.id));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allPerms = await prisma.permission.findMany({
    include: { groups: { where: { groupId: Number(groupId) } } },
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
  const { code, groupId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fir = await prisma.fIR.findUnique({ 
      where: { code: code.toUpperCase() } 
    });
    
    if (!fir) {
      return NextResponse.json({ error: "FIR not found" }, { status: 404 });
    }

    const isMainAdmin = session.user.role === "MAIN_ADMIN";
    const hasAccess =
      isMainAdmin ||
      (await userHasPermission(Number(session.user.cid), "fir.manage", fir.id));
    
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates = await req.json();
    
    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const gId = Number(groupId);

    // Validiere die Updates
    for (const update of updates) {
      if (!update.permissionId || !update.scope) {
        return NextResponse.json(
          { error: "Each update must have permissionId and scope" }, 
          { status: 400 }
        );
      }

      // Prüfe ob die Permission existiert
      const permissionExists = await prisma.permission.findUnique({
        where: { id: Number(update.permissionId) }
      });

      if (!permissionExists) {
        return NextResponse.json(
          { error: `Permission with id ${update.permissionId} not found` }, 
          { status: 400 }
        );
      }

      // Scope Validierung für nicht-MainAdmins
      if (update.scope === "ALL" && !isMainAdmin) {
        return NextResponse.json(
          { error: "Insufficient permissions for ALL scope" }, 
          { status: 403 }
        );
      }
    }

    // Lösche alle bestehenden Berechtigungen der Gruppe
    await prisma.groupPermission.deleteMany({ 
      where: { groupId: gId } 
    });

    // Erstelle die neuen Berechtigungen
    for (const update of updates) {
      await prisma.groupPermission.create({
        data: { 
          groupId: gId, 
          permissionId: Number(update.permissionId), 
          scope: update.scope 
        },
      });
    }

    // Cache leeren
    clearCache();

    return NextResponse.json({ 
      success: true,
      message: `Updated ${updates.length} permissions for group ${gId}` 
    });

  } catch (error) {
    console.error("❌ PATCH permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
