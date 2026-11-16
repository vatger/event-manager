import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { isMainAdminCid } from "@/lib/acl/mainAdmins";
import { generateApiToken } from "@/lib/api/apiTokens";
import { isSameOriginJsonRequest } from "@/lib/api/sameOrigin";

/**
 * API-Tokens verwalten – nur Main Admins.
 *
 * GET: alle Tokens (ohne Hash). POST: neues Token; der Klartext steht nur in
 * dieser einen Antwort.
 */

async function requireMainAdmin(): Promise<number | null> {
  const user = await getSessionUser();
  const cid = Number(user?.cid);
  return user && isMainAdminCid(cid) ? cid : null;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  firCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}$/)
    .nullable(),
  /** Laufzeit in Tagen, null = unbegrenzt */
  expiresInDays: z.number().int().min(1).max(730).nullable(),
});

export async function GET() {
  if (!(await requireMainAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tokens = await prisma.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      firCode: true,
      createdByCID: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
  const cids = [...new Set(tokens.map((t) => t.createdByCID))];
  const users = await prisma.user.findMany({ where: { cid: { in: cids } }, select: { cid: true, name: true } });
  const nameByCid = new Map(users.map((u) => [u.cid, u.name]));

  return NextResponse.json(
    {
      tokens: tokens.map((t) => ({ ...t, createdByName: nameByCid.get(t.createdByCID) ?? null })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const cid = await requireMainAdmin();
  if (!cid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isSameOriginJsonRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Angaben" }, { status: 400 });
  const { name, firCode, expiresInDays } = parsed.data;

  if (firCode && !(await prisma.fIR.findUnique({ where: { code: firCode }, select: { code: true } }))) {
    return NextResponse.json({ error: "FIR nicht gefunden" }, { status: 400 });
  }

  const { token, hash, prefix } = generateApiToken();
  const created = await prisma.apiToken.create({
    data: {
      name,
      tokenHash: hash,
      tokenPrefix: prefix,
      firCode,
      createdByCID: cid,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
    },
    select: { id: true, name: true, tokenPrefix: true, firCode: true, expiresAt: true },
  });

  return NextResponse.json(
    { token: created, secret: token },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
