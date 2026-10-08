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
});

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
  await logRosterActivity({
    rosterId: roster.id,
    actorCID: Number(user.cid),
    action: "auto_roster",
    summary: `${parts.join(", ")}${snapshotId ? " (Zwischenstand gesichert)" : ""}`,
    details: { mode, created: created.length, removed: removedCount, snapshotId },
  });

  broadcastRosterChange(eventId, req.headers.get("x-roster-client"));
  return NextResponse.json(
    { created, deletedCount: mode === "replace" ? removedCount : 0, snapshotId },
    { status: 201 }
  );
}
