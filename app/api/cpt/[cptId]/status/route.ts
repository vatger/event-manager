import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canManageCptStatus,
  fetchTrainingCpts,
} from "@/lib/cpt/cptService";
import { resolveCptFir } from "@/config/cptFirMapping";
import { parseCptDate } from "@/lib/cpt/cptDate";

const patchSchema = z.object({
  posted: z.boolean().optional(),
  forumUrl: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Pflegt den lokalen Arbeitsstand eines CPTs: gepostet-Markierung,
 * Link zum Forumsbeitrag und interne Notiz.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cptId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cptId: idParam } = await params;
  const cptId = Number(idParam);
  if (!Number.isInteger(cptId)) {
    return NextResponse.json({ error: "Ungültige CPT-ID" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  // Den CPT in der Training-API nachschlagen: Nur so lässt sich die FIR
  // sicher bestimmen – und nur die zuständige FIR darf ihn bearbeiten.
  let cpt;
  try {
    const cpts = await fetchTrainingCpts(0);
    cpt = cpts.find((c) => c.id === cptId);
  } catch (error) {
    console.error("[CPT Status] Training-API nicht erreichbar:", error);
    return NextResponse.json(
      { error: "Training-API ist derzeit nicht erreichbar" },
      { status: 502 }
    );
  }

  if (!cpt) {
    return NextResponse.json({ error: "CPT nicht gefunden" }, { status: 404 });
  }

  const firCode = resolveCptFir(cpt.position);
  if (!firCode) {
    return NextResponse.json(
      { error: "Die FIR dieses CPTs lässt sich nicht bestimmen" },
      { status: 422 }
    );
  }

  const cid = Number(user.cid);
  if (!(await canManageCptStatus(cid, firCode))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { posted, forumUrl, notes } = parsed.data;
  const snapshot = {
    firCode,
    position: cpt.position,
    traineeName: cpt.trainee_name,
    cptDate: parseCptDate(cpt.date),
  };

  // Beim Setzen von "gepostet" wird festgehalten, wer es wann markiert hat;
  // beim Zurücknehmen fallen beide Angaben wieder weg.
  const postedFields =
    posted === undefined
      ? {}
      : posted
        ? { posted: true, postedAt: new Date(), postedByCID: cid }
        : { posted: false, postedAt: null, postedByCID: null };

  const row = await prisma.cptStatus.upsert({
    where: { cptId },
    create: {
      cptId,
      ...snapshot,
      ...postedFields,
      ...(forumUrl !== undefined ? { forumUrl: forumUrl || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
    update: {
      ...snapshot,
      ...postedFields,
      ...(forumUrl !== undefined ? { forumUrl: forumUrl || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    status: {
      posted: row.posted,
      postedAt: row.postedAt?.toISOString() ?? null,
      postedByCID: row.postedByCID,
      postedByName: row.postedByCID === cid ? user.name ?? null : null,
      forumUrl: row.forumUrl,
      notes: row.notes,
    },
  });
}
