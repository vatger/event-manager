import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/getSessionUser";
import { getEffectiveLevel } from "@/lib/acl/policies";
import { GroupKind, PermissionScope } from "@prisma/client";

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

  const { level } = await getEffectiveLevel(Number(me.cid));
  // Nur MainAdmin oder VATGER-Leitung dürfen FIRs anlegen
  if (level !== "MAIN_ADMIN" && level !== "VATGER_LEITUNG") {
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
