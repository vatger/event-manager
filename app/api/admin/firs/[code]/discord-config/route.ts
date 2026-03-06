import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canManageFir } from "@/lib/acl/permissions";

/**
 * GET /api/admin/firs/[code]/discord-config
 * Get Discord configuration for a FIR
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
    include: { discordConfig: true },
  });

  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  return NextResponse.json({ discordConfig: fir.discordConfig ?? null });
}

/**
 * PUT /api/admin/firs/[code]/discord-config
 * Create or update Discord configuration for a FIR
 * Body: { channelId: string, roleId?: string }
 */
export async function PUT(
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
  const { channelId, roleId } = body;

  if (!channelId || typeof channelId !== "string" || channelId.trim() === "") {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const fir = await prisma.fIR.findUnique({ where: { code } });
  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  const discordConfig = await prisma.firDiscordConfig.upsert({
    where: { firId: fir.id },
    create: {
      firId: fir.id,
      channelId: channelId.trim(),
      roleId: roleId?.trim() || null,
    },
    update: {
      channelId: channelId.trim(),
      roleId: roleId?.trim() || null,
    },
  });

  return NextResponse.json({ discordConfig });
}

/**
 * DELETE /api/admin/firs/[code]/discord-config
 * Remove Discord configuration for a FIR
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

  const fir = await prisma.fIR.findUnique({
    where: { code },
    include: { discordConfig: true },
  });

  if (!fir) {
    return NextResponse.json({ error: "FIR not found" }, { status: 404 });
  }

  if (!fir.discordConfig) {
    return NextResponse.json({ error: "No Discord config found" }, { status: 404 });
  }

  await prisma.firDiscordConfig.delete({ where: { firId: fir.id } });

  return NextResponse.json({ message: "Discord configuration removed" });
}
