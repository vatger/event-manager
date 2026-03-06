import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userHasFirPermission, isVatgerEventleitung } from "@/lib/acl/permissions";

async function canManageManagers(cid: number, configId: number): Promise<boolean> {
  if (await isVatgerEventleitung(cid)) return true;
  const config = await prisma.weeklyEventConfiguration.findUnique({
    where: { id: configId },
    include: { fir: true },
  });
  if (!config?.fir) return false;
  return userHasFirPermission(cid, config.fir.code, "event.edit");
}

/**
 * DELETE /api/admin/weeklys/[id]/managers/[managerCid]
 * Remove a user from weekly event managers
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; managerCid: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, managerCid } = await params;
  const configId = parseInt(id);
  const targetCid = parseInt(managerCid);

  if (isNaN(configId) || isNaN(targetCid)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  if (!(await canManageManagers(Number(session.user.cid), configId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.weeklyEventManager.findUnique({
    where: { userCID_configId: { userCID: targetCid, configId } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  await prisma.weeklyEventManager.delete({
    where: { userCID_configId: { userCID: targetCid, configId } },
  });

  return NextResponse.json({ message: "Manager removed successfully" });
}
