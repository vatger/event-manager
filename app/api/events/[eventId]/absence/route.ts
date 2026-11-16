import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { canReportAbsence, normalizeAbsenceReason } from "@/lib/events/eventAbsence";

/**
 * Eigene „Ich bin nicht dabei“-Meldung zu einem Event.
 *
 * GET: Stand lesen. PUT: melden (optional mit Grund). DELETE: zurücknehmen.
 * Wer aktiv angemeldet ist, muss sich zuerst abmelden – beides zugleich
 * ergäbe keinen Sinn.
 */

async function context(params: Promise<{ eventId: string }>) {
  const user = await getSessionUser();
  if (!user?.cid) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { eventId } = await params;
  const id = Number(eventId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { error: NextResponse.json({ error: "Invalid event id" }, { status: 400 }) };
  }
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, status: true, endTime: true },
  });
  if (!event || event.status === "DRAFT") {
    return { error: NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 }) };
  }
  return { cid: Number(user.cid), rating: user.rating, event };
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  const absence = await prisma.eventAbsence.findUnique({
    where: { eventId_userCID: { eventId: ctx.event.id, userCID: ctx.cid } },
    select: { reason: true, createdAt: true },
  });
  return NextResponse.json({
    absent: !!absence,
    reason: absence?.reason ?? null,
    since: absence?.createdAt ?? null,
    canReport: canReportAbsence(ctx.event),
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  // Wie bei der Anmeldung: Beobachter können ohnehin nicht eingeplant werden
  if (ctx.rating === "OBS") {
    return NextResponse.json({ error: "Nur für Lotsen" }, { status: 403 });
  }
  if (!canReportAbsence(ctx.event)) {
    return NextResponse.json({ error: "Für dieses Event ist das nicht mehr möglich." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = normalizeAbsenceReason(body?.reason);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const signup = await prisma.eventSignup.findUnique({
    where: { eventId_userCID: { eventId: ctx.event.id, userCID: ctx.cid } },
    select: { deletedAt: true },
  });
  if (signup && !signup.deletedAt) {
    return NextResponse.json(
      { error: "Du bist für dieses Event angemeldet. Melde dich zuerst ab." },
      { status: 409 }
    );
  }

  // Die Relation braucht einen Nutzer-Datensatz; wer eingeloggt ist, hat einen
  const absence = await prisma.eventAbsence.upsert({
    where: { eventId_userCID: { eventId: ctx.event.id, userCID: ctx.cid } },
    create: { eventId: ctx.event.id, userCID: ctx.cid, reason: parsed.reason },
    update: { reason: parsed.reason },
    select: { reason: true, createdAt: true },
  });
  return NextResponse.json({ absent: true, reason: absence.reason, since: absence.createdAt });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await context(params);
  if ("error" in ctx) return ctx.error;
  await prisma.eventAbsence.deleteMany({ where: { eventId: ctx.event.id, userCID: ctx.cid } });
  return NextResponse.json({ absent: false });
}
