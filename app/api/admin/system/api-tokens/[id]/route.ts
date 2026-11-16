import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { isMainAdminCid } from "@/lib/acl/mainAdmins";
import { isSameOriginJsonRequest } from "@/lib/api/sameOrigin";

/**
 * DELETE: Token widerrufen – nur Main Admins. Die Zeile bleibt mit
 * revokedAt stehen, damit nachvollziehbar ist, was es gab.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isMainAdminCid(Number(user.cid))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isSameOriginJsonRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { count } = await prisma.apiToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "Token nicht gefunden" }, { status: 404 });
  return NextResponse.json({ revoked: true });
}
