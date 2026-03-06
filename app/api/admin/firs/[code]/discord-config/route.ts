import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageFir } from "@/lib/acl/permissions";
import { DISCORD_NOTIFICATION_TYPES } from "@/lib/discord/notificationTypes";

const VALID_TYPES = Object.values(DISCORD_NOTIFICATION_TYPES);

/**
 * GET /api/admin/firs/[code]/discord-config
 * List all Discord notification configs for a FIR
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  if (!(await canManageFir(Number(session.user.cid), code))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fir = await prisma.fIR.findUnique({
    where: { code },
    include: {
      discordNotifications: {
        include: {
          weeklyConfig: { select: { id: true, name: true } },
        },
        orderBy: [{ notificationType: "asc" }, { weeklyConfigId: "asc" }],
      },
    },
  });

  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  return NextResponse.json({ discordNotifications: fir.discordNotifications });
}

/**
 * POST /api/admin/firs/[code]/discord-config
 * Create or update a Discord notification config for a FIR.
 * Body: { notificationType, channelId, roleId?, weeklyConfigId?, label? }
 * If a config for (firId, notificationType, weeklyConfigId) already exists, it is updated.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  if (!(await canManageFir(Number(session.user.cid), code))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { notificationType, channelId, roleId, weeklyConfigId, label } = body;

  if (!notificationType || !VALID_TYPES.includes(notificationType)) {
    return NextResponse.json(
      { error: `notificationType must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!channelId || typeof channelId !== "string" || channelId.trim() === "") {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  const resolvedWeeklyConfigId = weeklyConfigId ? Number(weeklyConfigId) : null;

  // Upsert: find existing by (firId, notificationType, weeklyConfigId), then update or create
  const existing = await prisma.firDiscordNotification.findFirst({
    where: {
      firId: fir.id,
      notificationType,
      weeklyConfigId: resolvedWeeklyConfigId,
    },
  });

  let record;
  if (existing) {
    record = await prisma.firDiscordNotification.update({
      where: { id: existing.id },
      data: {
        channelId: channelId.trim(),
        roleId: roleId?.trim() || null,
        label: label?.trim() || null,
      },
      include: { weeklyConfig: { select: { id: true, name: true } } },
    });
  } else {
    record = await prisma.firDiscordNotification.create({
      data: {
        firId: fir.id,
        notificationType,
        weeklyConfigId: resolvedWeeklyConfigId,
        channelId: channelId.trim(),
        roleId: roleId?.trim() || null,
        label: label?.trim() || null,
      },
      include: { weeklyConfig: { select: { id: true, name: true } } },
    });
  }

  return NextResponse.json({ discordNotification: record }, { status: existing ? 200 : 201 });
}

/**
 * DELETE /api/admin/firs/[code]/discord-config
 * Delete a specific Discord notification config by ID.
 * Body: { id: number }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  if (!(await canManageFir(Number(session.user.cid), code))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id } = body;
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  const record = await prisma.firDiscordNotification.findFirst({
    where: { id: Number(id), firId: fir.id },
  });
  if (!record) {
    return NextResponse.json({ error: "Notification config not found" }, { status: 404 });
  }

  await prisma.firDiscordNotification.delete({ where: { id: record.id } });

  return NextResponse.json({ message: "Discord notification config removed" });
}
