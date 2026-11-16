import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/getSessionUser";
import { getUserWithEffectiveData, type UserWithEffectiveData } from "./policies";
import { isGlobalLevel } from "./effective";
import { isPermissionKey } from "./catalog";
import { canManageDepartment } from "./teamRules";
import type { Department, GroupKind, TeamGroup } from "@/types/fir";

/**
 * Server-Bausteine des Bereichs „Team & Rechte“: Zugriff prüfen, ein
 * Department laden und Mitgliedschaften pflegen. Die Regeln selbst stehen in
 * teamRules.ts.
 */

type Fir = { id: number; code: string; name: string };

export type TeamContext = { actor: UserWithEffectiveData; fir: Fir };

const deny = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Angemeldeter Nutzer samt Rollen – oder die passende Fehlerantwort. */
export async function requireActor(): Promise<UserWithEffectiveData | NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return deny("Nicht angemeldet", 401);
  const actor = await getUserWithEffectiveData(Number(sessionUser.cid));
  if (!actor) return deny("Nutzer nicht gefunden", 404);
  return actor;
}

/**
 * Angemeldeter Nutzer und FIR aus der URL – nur, wenn er dieses Department
 * verwalten darf.
 */
export async function requireDepartment(code: string): Promise<TeamContext | NextResponse> {
  const actor = await requireActor();
  if (actor instanceof NextResponse) return actor;

  const fir = await prisma.fIR.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true, code: true, name: true },
  });
  if (!fir) return deny("FIR nicht gefunden", 404);
  if (!canManageDepartment(actor, fir.code)) return deny("Keine Berechtigung", 403);

  return { actor, fir };
}

/**
 * Gruppe aus der URL. Sie muss zur FIR gehören – sonst ließen sich über die
 * eigene FIR-Adresse Gruppen fremder FIRs ansprechen.
 */
export async function loadGroup(fir: Fir, groupId: string) {
  const id = Number(groupId);
  if (!Number.isInteger(id)) return null;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group || group.firId !== fir.id) return null;
  return { ...group, firCode: fir.code };
}

const byLeitungThenName = (a: { kind: string; name: string }, b: { kind: string; name: string }) => {
  if (a.kind !== b.kind) return a.kind === "FIR_LEITUNG" ? -1 : 1;
  return a.name.localeCompare(b.name, "de");
};

/** Das vollständige Department einer FIR für die Oberfläche. */
export async function loadDepartment({ actor, fir }: TeamContext): Promise<Department> {
  const groups = await prisma.group.findMany({
    where: { firId: fir.id },
    include: {
      members: { include: { user: { select: { cid: true, name: true, rating: true } } } },
      permissions: { include: { permission: { select: { key: true } } } },
    },
  });

  const mapped: TeamGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    kind: g.kind as GroupKind,
    permissions:
      g.kind === "FIR_LEITUNG"
        ? []
        : g.permissions.map((p) => p.permission.key).filter(isPermissionKey),
    members: g.members
      .map((m) => m.user)
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  }));

  return {
    code: fir.code,
    name: fir.name,
    groups: mapped.sort(byLeitungThenName),
    viewer: { isGlobal: isGlobalLevel(actor.effectiveLevel) },
  };
}

/**
 * Hält `User.firId` passend zu den Mitgliedschaften: Wer in keiner Gruppe der
 * FIR mehr ist, gehört nicht mehr zu ihrem Department.
 */
export async function releaseFirIfNoGroups(cids: number[], firId: number) {
  if (cids.length === 0) return;
  const stillMember = await prisma.userGroup.findMany({
    where: { userCID: { in: cids }, group: { firId } },
    select: { userCID: true },
  });
  const keep = new Set(stillMember.map((m) => m.userCID));
  const released = cids.filter((cid) => !keep.has(cid));
  if (released.length === 0) return;
  await prisma.user.updateMany({
    where: { cid: { in: released }, firId },
    data: { firId: null },
  });
}

export type AddMemberResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Nimmt eine Person in eine Gruppe auf. Jede Person gehört höchstens einem
 * FIR-Department an – ist sie schon in einem anderen, wird abgelehnt.
 */
export async function addGroupMember(
  fir: Fir,
  groupId: number,
  cid: number
): Promise<AddMemberResult> {
  const target = await prisma.user.findUnique({
    where: { cid },
    include: { fir: { select: { code: true } } },
  });
  if (!target) {
    return {
      ok: false,
      status: 404,
      error: "Diese Person hat sich noch nie im Eventmanager angemeldet.",
    };
  }
  if (target.firId && target.firId !== fir.id) {
    return {
      ok: false,
      status: 409,
      error: `${target.name} gehört bereits zum Eventdepartment ${target.fir?.code ?? "einer anderen FIR"}.`,
    };
  }

  await prisma.$transaction([
    prisma.userGroup.upsert({
      where: { userCID_groupId: { userCID: cid, groupId } },
      update: {},
      create: { userCID: cid, groupId },
    }),
    prisma.user.update({ where: { cid }, data: { firId: fir.id } }),
  ]);
  return { ok: true };
}
