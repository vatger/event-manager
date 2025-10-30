import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/getSessionUser";
import { GroupKind, PermissionScope } from "@prisma/client";
import { getUserWithPermissions, userHasPermission } from "@/lib/acl/permissions";
import { CurrentUser } from "@/types/fir";

const firSchema = z.object({
  code: z.string().length(4, "FIR Code must be 4 letters"),
  name: z.string().min(3),
});

// Legt fehlende Basis-Permissions an (ohne scope – scope gehört zu GroupPermission)
async function ensureBasePermissions() {
  const permissions = [
    { key: "event.create", description: "Events erstellen" },
    { key: "event.edit", description: "Events bearbeiten" },
    { key: "event.delete", description: "Events löschen" },
    { key: "group.manage", description: "Gruppen verwalten" },
    { key: "roster.publish", description: "Roster veröffentlichen" },
  ] as const;

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description }, 
    });
  }
}

// Erstellt für eine FIR die Standardgruppen + GroupPermissions (mit Scope)
async function createStandardGroups(firId: number, firCode: string) {
  // IDs der relevanten Permissions holen
  const baseKeys = [
    "event.create",
    "event.edit",
    "event.delete",
    "group.manage",
    "roster.publish",
  ] as const;

  const allPerms = await prisma.permission.findMany({
    where: { key: { in: baseKeys as unknown as string[] } },
  });
  const byKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

  // FIR-Leitung
  const firLeitung = await prisma.group.create({
    data: {
      name: `FIR ${firCode.toUpperCase()} Leitung`,
      description: `Eventleitung der FIR ${firCode.toUpperCase()}`,
      kind: GroupKind.FIR_LEITUNG,
      firId,
    },
  });

  const leitungPerms: (typeof baseKeys)[number][] = [
    "event.create",
    "event.edit",
    "event.delete",
    "group.manage",
    "roster.publish",
  ];
  await prisma.groupPermission.createMany({
    data: leitungPerms.map((key) => ({
      groupId: firLeitung.id,
      permissionId: byKey[key],
      scope: PermissionScope.OWN_FIR,
    })),
    skipDuplicates: true,
  });

  // FIR-Event-Team
  const firTeam = await prisma.group.create({
    data: {
      name: `FIR ${firCode.toUpperCase()} Event Team`,
      description: `Eventteam der FIR ${firCode.toUpperCase()}`,
      kind: GroupKind.FIR_TEAM,
      firId,
    },
  });

  const teamPerms: (typeof baseKeys)[number][] = ["event.edit"];
  await prisma.groupPermission.createMany({
    data: teamPerms.map((key) => ({
      groupId: firTeam.id,
      permissionId: byKey[key],
      scope: PermissionScope.OWN_FIR,
    })),
    skipDuplicates: true,
  });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserWithPermissions(Number(me.cid))
  
  // Nur MainAdmin oder VATGER-Leitung dürfen FIRs anlegen
  if (!userHasPermission(Number(user?.cid), "fir.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = firSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { code, name } = parsed.data;

  // 1) FIR anlegen
  const fir = await prisma.fIR.create({
    data: { code: code.toUpperCase(), name },
  });

  // 2) Basis-Permissions sicherstellen
  await ensureBasePermissions();

  // 3) Standardgruppen + Rechte erzeugen
  await createStandardGroups(fir.id, code);

  return NextResponse.json({ success: true, fir }, { status: 201 });
}

/**
 * GET /api/firs
 * Gibt alle FIRs inkl. Gruppen, Mitglieder & Berechtigungen zurück.
 * Zugriff nur für MAINADMIN, VATGER_LEITUNG oder FIR_LEITUNG (eigene FIR).
 */
export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = (await getUserWithPermissions(
    Number(sessionUser.cid)
  )) as CurrentUser | null;
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isGlobal =
    user.effectiveLevel === "MAIN_ADMIN" ||
    user.effectiveLevel === "VATGER_LEITUNG";
  console.log("user", user, "global", isGlobal)
  const canManageOwnFIR =
    !!user.fir?.code &&
    user.firScopedPermissions[user.fir.code]?.includes("fir.manage");
  
  if (!isGlobal && !canManageOwnFIR) {
    return NextResponse.json(
      { error: "Forbidden", level: user.effectiveLevel },
      { status: 403 }
    );
  }
  
  // MainAdmin / VATGER-Leitung → alle FIRs
  // FIR-Leitung → nur eigene FIR
  const firFilter = isGlobal
    ? {}
    : { id: user.fir?.id ?? -1 }; // eigene FIR oder nichts
  
  const firs = await prisma.fIR.findMany({
    where: firFilter,
    include: {
      groups: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  cid: true,
                  name: true,
                  rating: true,
                  role: true,
                },
              },
            },
          },
          permissions: {
            include: {
              permission: {
                select: {
                  key: true,
                  description: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  // Daten etwas aufbereiten (flacher, lesbarer fürs Frontend)
  const response = firs.map((fir) => ({
    id: fir.id,
    code: fir.code,
    name: fir.name,
    groups: fir.groups.map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind,
      description: g.description,
      members: g.members.map((m) => ({
        id: m.user.id,
        cid: m.user.cid,
        name: m.user.name,
        rating: m.user.rating,
        role: m.user.role,
      })),
      permissions: g.permissions.map((p) => ({
        key: p.permission.key,
        description: p.permission.description,
        scope: p.scope,
      })),
    })),
  }));
  return NextResponse.json(response);
}
