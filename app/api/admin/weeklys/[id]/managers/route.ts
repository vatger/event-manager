import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { userHasFirPermission, isVatgerEventleitung } from "@/lib/acl/permissions";

const managerUserSelect = {
  cid: true,
  name: true,
  rating: true,
} as const;

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
 * GET /api/admin/weeklys/[id]/managers
 * List weekly event managers for this config
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const configId = parseInt(id);
  if (isNaN(configId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  if (!(await canManageManagers(Number(session.user.cid), configId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const managers = await prisma.weeklyEventManager.findMany({
    where: { configId },
    include: {
      user: {
        select: managerUserSelect,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ managers });
}

/**
 * POST /api/admin/weeklys/[id]/managers
 * Add a user as a weekly event manager
 * Body: { userCID: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const configId = parseInt(id);
  if (isNaN(configId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  if (!(await canManageManagers(Number(session.user.cid), configId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userCID } = body;
  if (!userCID || isNaN(Number(userCID))) {
    return NextResponse.json({ error: "Invalid userCID" }, { status: 400 });
  }

  // Verify the config exists
  const config = await prisma.weeklyEventConfiguration.findUnique({
    where: { id: configId },
  });
  if (!config) {
    return NextResponse.json({ error: "Weekly event not found" }, { status: 404 });
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { cid: Number(userCID) },
    select: { cid: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Upsert (idempotent add)
  const manager = await prisma.weeklyEventManager.upsert({
    where: { userCID_configId: { userCID: Number(userCID), configId } },
    create: { userCID: Number(userCID), configId },
    update: {},
    include: {
      user: { select: managerUserSelect },
    },
  });

  return NextResponse.json({ manager }, { status: 201 });
}
