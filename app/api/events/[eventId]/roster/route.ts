import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { isEventFirTeamMember } from "@/lib/acl/permissions";
import {
  canManageEventRoster,
  getRosterForEvent,
} from "@/lib/roster/eventRosterService";

const createSchema = z.object({
  slotMinutes: z.number().int().refine((v) => [15, 30].includes(v), {
    message: "slotMinutes must be 15 or 30",
  }),
  stations: z.array(z.string().min(3).max(20)).min(1, "Mindestens eine Station"),
});

const updateSchema = z.object({
  slotMinutes: z
    .number()
    .int()
    .refine((v) => [15, 30].includes(v), { message: "slotMinutes must be 15 or 30" })
    .optional(),
  stations: z.array(z.string().min(3).max(20)).min(1).optional(),
});

function normalizeStations(stations: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of stations) {
    const cs = s.trim().toUpperCase();
    if (cs && !seen.has(cs)) {
      seen.add(cs);
      result.push(cs);
    }
  }
  return result;
}

async function loadEvent(eventId: number) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

// GET: Roster inkl. Stationen + Zuweisungen (null wenn noch nicht angelegt)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const event = await loadEvent(eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const cid = Number(user.cid);
  const canEdit = await canManageEventRoster(cid, eventId);
  if (!canEdit && !(await isEventFirTeamMember(cid, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await getRosterForEvent(eventId);
  return NextResponse.json({ roster, canEdit });
}

// POST: Roster anlegen (Stationen bestätigen + Rastergröße wählen)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  const event = await loadEvent(eventId);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (!(await canManageEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const existing = await prisma.eventRoster.findUnique({ where: { eventId } });
  if (existing) {
    return NextResponse.json({ error: "Roster existiert bereits" }, { status: 409 });
  }

  const stations = normalizeStations(parsed.data.stations);
  await prisma.eventRoster.create({
    data: {
      eventId,
      slotMinutes: parsed.data.slotMinutes,
      stations: {
        create: stations.map((callsign, i) => ({ callsign, sortOrder: i })),
      },
    },
  });

  const roster = await getRosterForEvent(eventId);
  return NextResponse.json({ roster, canEdit: true }, { status: 201 });
}

// PATCH: Rastergröße und/oder Stationsliste anpassen
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  if (!(await canManageEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await getRosterForEvent(eventId);
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.slotMinutes) {
      await tx.eventRoster.update({
        where: { id: roster.id },
        data: { slotMinutes: parsed.data.slotMinutes },
      });
    }

    if (parsed.data.stations) {
      const wanted = normalizeStations(parsed.data.stations);
      const existing = roster.stations;

      // Entfernte Stationen löschen (Zuweisungen cascaden mit)
      const removed = existing.filter((s) => !wanted.includes(s.callsign));
      if (removed.length > 0) {
        await tx.eventRosterStation.deleteMany({
          where: { id: { in: removed.map((s) => s.id) } },
        });
      }

      // Neue anlegen, Reihenfolge aktualisieren
      for (let i = 0; i < wanted.length; i++) {
        const callsign = wanted[i];
        const found = existing.find((s) => s.callsign === callsign);
        if (found) {
          if (found.sortOrder !== i) {
            await tx.eventRosterStation.update({
              where: { id: found.id },
              data: { sortOrder: i },
            });
          }
        } else {
          await tx.eventRosterStation.create({
            data: { rosterId: roster.id, callsign, sortOrder: i },
          });
        }
      }
    }
  });

  const updated = await getRosterForEvent(eventId);
  return NextResponse.json({ roster: updated, canEdit: true });
}

// DELETE: Roster komplett löschen (z. B. um neu zu starten)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId: idParam } = await params;
  const eventId = Number(idParam);
  if (isNaN(eventId)) return NextResponse.json({ error: "Invalid event id" }, { status: 400 });

  if (!(await canManageEventRoster(Number(user.cid), eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roster = await prisma.eventRoster.findUnique({ where: { eventId } });
  if (!roster) return NextResponse.json({ error: "Roster not found" }, { status: 404 });

  await prisma.eventRoster.delete({ where: { id: roster.id } });
  return NextResponse.json({ success: true });
}
