import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseFirIfNoGroups, requireDepartment } from "@/lib/acl/teamService";
import { explainPermissions } from "@/lib/acl/access";
import { isPermissionKey } from "@/lib/acl/catalog";
import { isGlobalLevel } from "@/lib/acl/effective";
import { isMainAdminCid } from "@/lib/acl/mainAdmins";
import type { GroupKind, PersonAccess } from "@/types/fir";

type Params = { params: Promise<{ code: string; cid: string }> };

/**
 * GET /api/firs/[code]/people/[cid]
 * Zugriff einer Person im Department: jedes Recht mit seiner Herkunft, dazu
 * die Rollen, die an einzelnen Events, Weeklys oder CPTs hängen.
 */
export async function GET(_: Request, { params }: Params) {
  const { code, cid: rawCid } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const cid = Number(rawCid);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "Ungültige CID" }, { status: 400 });
  }

  const person = await prisma.user.findUnique({
    where: { cid },
    select: {
      cid: true,
      name: true,
      rating: true,
      vatgerLeitung: { select: { id: true } },
      groups: {
        where: { group: { firId: ctx.fir.id } },
        select: {
          group: {
            select: {
              id: true,
              name: true,
              kind: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  if (!person || person.groups.length === 0) {
    return NextResponse.json(
      { error: "Die Person gehört nicht zu diesem Department." },
      { status: 404 }
    );
  }

  const groups = person.groups
    .map((ug) => ug.group)
    .sort((a, b) =>
      a.kind !== b.kind ? (a.kind === "FIR_LEITUNG" ? -1 : 1) : a.name.localeCompare(b.name, "de")
    );

  const now = new Date();
  const [responsible, weeklys, rosterEditor, cpt] = await Promise.all([
    prisma.eventResponsible.findMany({
      where: { userCID: cid, event: { firCode: ctx.fir.code, endTime: { gte: now } } },
      select: { event: { select: { id: true, name: true, startTime: true } } },
      orderBy: { event: { startTime: "asc" } },
    }),
    prisma.weeklyEventManager.findMany({
      where: { userCID: cid, config: { firId: ctx.fir.id } },
      select: { config: { select: { id: true, name: true } } },
    }),
    prisma.eventRosterEditor.findMany({
      where: { userCID: cid, roster: { event: { firCode: ctx.fir.code, endTime: { gte: now } } } },
      select: { roster: { select: { event: { select: { id: true, name: true, startTime: true } } } } },
    }),
    prisma.cptResponsible.findUnique({
      where: { firCode_userCID: { firCode: ctx.fir.code, userCID: cid } },
      select: { id: true },
    }),
  ]);

  const response: PersonAccess = {
    cid: person.cid,
    name: person.name,
    rating: person.rating,
    isMainAdmin: isMainAdminCid(person.cid),
    isVatgerLeitung: !!person.vatgerLeitung,
    groups: groups.map((g) => ({ id: g.id, name: g.name, kind: g.kind as GroupKind })),
    permissions: explainPermissions(
      groups.map((g) => ({
        name: g.name,
        kind: g.kind,
        permissions: g.permissions.map((p) => p.permission.key).filter(isPermissionKey),
      }))
    ),
    objectRoles: {
      responsibleEvents: responsible.map((r) => ({
        id: r.event.id,
        name: r.event.name,
        startTime: r.event.startTime.toISOString(),
      })),
      managedWeeklys: weeklys.map((w) => w.config),
      rosterEditorEvents: rosterEditor.map((r) => ({
        id: r.roster.event.id,
        name: r.roster.event.name,
        startTime: r.roster.event.startTime.toISOString(),
      })),
      cptResponsible: !!cpt,
    },
  };

  return NextResponse.json(response);
}

/**
 * DELETE /api/firs/[code]/people/[cid]
 * Entfernt eine Person aus allen Gruppen des Departments. Mitglieder der
 * Leitungsgruppe entfernt nur die VATGER-Eventleitung.
 */
export async function DELETE(_: Request, { params }: Params) {
  const { code, cid: rawCid } = await params;
  const ctx = await requireDepartment(code);
  if (ctx instanceof NextResponse) return ctx;

  const cid = Number(rawCid);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "Ungültige CID" }, { status: 400 });
  }

  const memberships = await prisma.userGroup.findMany({
    where: { userCID: cid, group: { firId: ctx.fir.id } },
    select: { id: true, group: { select: { kind: true } } },
  });
  if (memberships.length === 0) {
    return NextResponse.json(
      { error: "Die Person gehört nicht zu diesem Department." },
      { status: 404 }
    );
  }

  const inLeitung = memberships.some((m) => m.group.kind === "FIR_LEITUNG");
  if (inLeitung && !isGlobalLevel(ctx.actor.effectiveLevel)) {
    return NextResponse.json(
      { error: "Mitglieder der Leitungsgruppe entfernt nur die VATGER-Eventleitung." },
      { status: 403 }
    );
  }

  await prisma.userGroup.deleteMany({ where: { id: { in: memberships.map((m) => m.id) } } });
  await releaseFirIfNoGroups([cid], ctx.fir.id);

  return NextResponse.json({ success: true });
}
