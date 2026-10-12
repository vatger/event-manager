import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import {
  canEditEventRoster,
  createRosterSnapshot,
  getRosterForEvent,
  validateAssignment,
  type AssignmentInput,
  type RosterWithRelations,
} from "@/lib/roster/eventRosterService";
import { broadcastRosterChange } from "@/lib/roster/rosterEvents";
import { logRosterActivity } from "@/lib/roster/rosterActivity";
import type { EventRosterAssignment } from "@prisma/client";

const isoDate = z.string().refine((v) => !isNaN(Date.parse(v)), { message: "Invalid date" });

const bodySchema = z.object({
  /**
   * "fill": bestehende Blöcke bleiben, nur Lücken werden gefüllt.
   * "replace": alle Controller-Schichten werden ersetzt; Custom- und
   * persönliche Blöcke ("Mentor") bleiben stehen.
   */
  mode: z.enum(["fill", "replace"]),
  /** Vorher einen Snapshot anlegen (Standard: ja, sofern der Plan nicht leer ist) */
  snapshot: z.boolean().optional(),
  snapshotName: z.string().min(1).max(80).optional(),
  assignments: z
    .array(
      z.object({
        stationId: z.number().int(),
        userCID: z.number().int(),
        startTime: isoDate,
        endTime: isoDate,
      })
    )
    .max(1000),
  /**
   * Wer auf einer laut Anmeldung nicht gewünschten Station gelandet ist
   * („kein DEL"). Diese Personen werden orange markiert.
   */
  wishConflicts: z
    .array(
      z.object({
        userCID: z.number().int(),
        callsigns: z.array(z.string().max(32)).max(50),
      })
    )
    .max(500)
    .optional(),
});

/**
 * Wunsch nicht erfüllbar: orange markieren und den Grund in die Notiz
 * schreiben. Eine rote Markierung bleibt stehen – sie hat eine eigene
 * Bedeutung und soll vom Auto-Roster nicht überschrieben werden.
 */
async function markWishConflicts(
  rosterId: number,
  actorCID: number,
  conflicts: { userCID: number; callsigns: string[] }[]
): Promise<number> {
  let marked = 0;
  for (const { userCID, callsigns } of conflicts) {
    const line = `Auto-Roster: Wunsch nicht erfüllbar – auf ${callsigns.join(", ")} eingeplant`;
    const existing = await prisma.eventRosterNote.findUnique({
      where: { rosterId_userCID: { rosterId, userCID } },
    });
    const oldNote = existing?.note ?? "";
    const note = oldNote.includes(line) ? oldNote : [oldNote, line].filter(Boolean).join("\n");
    const flag = existing?.flag === "red" ? "red" : "amber";
    await prisma.eventRosterNote.upsert({
      where: { rosterId_userCID: { rosterId, userCID } },
      create: { rosterId, userCID, note, flag, authorCID: actorCID },
      update: { note, flag, authorCID: actorCID },
    });
    marked++;
  }
  return marked;
}

/**
 * Übernimmt einen im Editor berechneten Auto-Roster-Plan auf einmal.
 *
 * Geplant wird im Browser (lib/roster/autoRoster) – dort liegen die
 * Anmeldungen samt Eignung ohnehin vor. Der Server prüft jeden Block mit
 * derselben Validierung wie beim einzelnen Anlegen und übernimmt alles oder
 * nichts: Hat parallel jemand den Plan geändert, kommt 409 zurück und der
 * Editor rechnet neu.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (!(await canEditEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { mode } = parsed.data;

  // Gegen den Stand prüfen, der nach der Übernahme gilt: bei "replace" ohne
  // die bisherigen Controller-Schichten, und jeder neue Block zählt für die
  // folgenden schon mit.
  const kept =
    mode === "replace"
      ? roster.assignments.filter((a) => a.type !== "controller")
      : roster.assignments;
  const removedCount = roster.assignments.length - kept.length;
  const working: RosterWithRelations = { ...roster, assignments: [...kept] };

  const inputs: AssignmentInput[] = [];
  for (const [index, item] of parsed.data.assignments.entries()) {
    const input: AssignmentInput = {
      stationId: item.stationId,
      type: "controller",
      userCID: item.userCID,
      label: null,
      color: null,
      startTime: new Date(item.startTime),
      endTime: new Date(item.endTime),
    };
    const error = await validateAssignment(event, working, input);
    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code, index },
        { status: 409 }
      );
    }
    inputs.push(input);
    working.assignments.push({
      id: -(index + 1),
      rosterId: roster.id,
      stationId: input.stationId,
      type: "controller",
      userCID: input.userCID ?? null,
      label: null,
      color: null,
      startTime: input.startTime,
      endTime: input.endTime,
    } as EventRosterAssignment);
  }

  let snapshotId: number | null = null;
  if (parsed.data.snapshot !== false && roster.assignments.length > 0) {
    const name =
      parsed.data.snapshotName ??
      `Vor Auto-Roster · ${new Date().toLocaleString("de-DE", { timeZone: "UTC" })} UTC`;
    snapshotId = (await createRosterSnapshot(roster, name, Number(user.cid))).id;
  }

  // Einzeln anlegen statt createMany: Der Editor braucht die IDs, um die
  // Übernahme mit Strg+Z zurücknehmen zu können.
  const created = await prisma.$transaction(
    async (tx) => {
      if (mode === "replace") {
        await tx.eventRosterAssignment.deleteMany({
          where: { rosterId: roster.id, type: "controller" },
        });
      }
      const rows: EventRosterAssignment[] = [];
      for (const input of inputs) {
        rows.push(
          await tx.eventRosterAssignment.create({
            data: {
              rosterId: roster.id,
              stationId: input.stationId,
              type: "controller",
              userCID: input.userCID ?? null,
              startTime: input.startTime,
              endTime: input.endTime,
            },
          })
        );
      }
      return rows;
    },
    { timeout: 30_000 }
  );

  const stationCount = new Set(inputs.map((i) => i.stationId)).size;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    `Auto-Roster: ${count(created.length, "Schicht", "Schichten")} auf ${count(
      stationCount,
      "Station",
      "Stationen"
    )} eingeplant`,
  ];
  if (mode === "replace") {
    parts.push(`${count(removedCount, "bisherige Schicht", "bisherige Schichten")} ersetzt`);
  }

  // Nur Personen, die in diesem Lauf tatsächlich eingeplant wurden
  const plannedCids = new Set(inputs.map((i) => i.userCID));
  const conflicts = (parsed.data.wishConflicts ?? []).filter((c) => plannedCids.has(c.userCID));
  const marked = await markWishConflicts(roster.id, Number(user.cid), conflicts);
  if (marked > 0) {
    parts.push(`${count(marked, "Person", "Personen")} mit nicht erfüllbarem Wunsch markiert`);
  }
  await logRosterActivity({
    rosterId: roster.id,
    actorCID: Number(user.cid),
    action: "auto_roster",
    summary: `${parts.join(", ")}${snapshotId ? " (Zwischenstand gesichert)" : ""}`,
    details: { mode, created: created.length, removed: removedCount, snapshotId, marked },
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json(
    { created, deletedCount: mode === "replace" ? removedCount : 0, snapshotId, marked },
    { status: 201 }
  );
}
