import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  addGroupMember,
  loadGroup,
  releaseFirIfNoGroups,
  requireDepartment,
} from "@/lib/acl/teamService";
import { canManageGroupMembers } from "@/lib/acl/teamRules";

type Params = { params: Promise<{ code: string; groupId: string }> };

const addSchema = z.object({ cid: z.coerce.number().int().positive() });

const LEITUNG_ONLY_VATGER = "Die Leitungsgruppe verwaltet nur die VATGER-Eventleitung.";

/** POST /api/firs/[code]/groups/[groupId]/members – Person in die Gruppe aufnehmen */
export async function POST(req: Request, { params }: Params) {
  const { code, groupId } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const group = await loadGroup(ctx.fir, groupId);
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
  if (!canManageGroupMembers(ctx.actor, group)) {
    return NextResponse.json({ error: LEITUNG_ONLY_VATGER }, { status: 403 });
  }

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige CID" }, { status: 400 });
  }

  const result = await addGroupMember(ctx.fir, group.id, parsed.data.cid);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true }, { status: 201 });
}

/** DELETE /api/firs/[code]/groups/[groupId]/members?cid=… – Person aus der Gruppe entfernen */
export async function DELETE(req: Request, { params }: Params) {
  const { code, groupId } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const group = await loadGroup(ctx.fir, groupId);
  if (!group) return NextResponse.json({ error: "Gruppe nicht gefunden" }, { status: 404 });
  if (!canManageGroupMembers(ctx.actor, group)) {
    return NextResponse.json({ error: LEITUNG_ONLY_VATGER }, { status: 403 });
  }

  const parsed = addSchema.safeParse({ cid: new URL(req.url).searchParams.get("cid") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige CID" }, { status: 400 });
  }
  const { cid } = parsed.data;

  await prisma.userGroup.deleteMany({ where: { userCID: cid, groupId: group.id } });
  await releaseFirIfNoGroups([cid], ctx.fir.id);

  return NextResponse.json({ success: true });
}
