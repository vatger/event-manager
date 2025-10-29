import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cid = Number(session.user.id);

  // 🔹 User mit FIR + Gruppen + Permissions
  const user = await prisma.user.findUnique({
    where: { cid },
    include: {
      fir: true,
      groups: {
        include: {
          group: {
            include: {
              fir: true,
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // =====================================================
  // 1️⃣ Effektive Berechtigungen global und pro FIR sammeln
  // =====================================================
  const effectivePermissions = new Set<string>();
  const firScopedPermissions: Record<string, string[]> = {}; // z. B. { "EDMM": ["fir.manage"] }

  // 🔸 MAIN_ADMIN darf alles
  if (user.role === "MAIN_ADMIN") {
    effectivePermissions.add("admin.access");
    effectivePermissions.add("fir.manage");
    effectivePermissions.add("event.create");
    effectivePermissions.add("event.edit");
    effectivePermissions.add("event.delete");
  }

  // 🔸 Gruppenbasiert
  for (const ug of user.groups) {
    const group = ug.group;
    if (!group) continue;

    // Gruppenspezifische Permissions
    for (const gp of group.permissions) {
      const key = gp.permission.key;

      if (gp.scope === "ALL" || !group.fir) {
        effectivePermissions.add(key);
      } else if (gp.scope === "OWN_FIR" && group.fir?.code) {
        if (!firScopedPermissions[group.fir.code]) {
          firScopedPermissions[group.fir.code] = [];
        }
        firScopedPermissions[group.fir.code].push(key);
      }
    }
  }

  // =====================================================
  // 2️⃣ Effektives Level bestimmen
  // =====================================================
  let effectiveLevel = "USER";

  if (user.role === "MAIN_ADMIN") {
    effectiveLevel = "MAIN_ADMIN";
  } else {
    // Suche nach Gruppen mit kind == "FIR_LEITUNG"
    const firLeadGroups = user.groups.filter((ug) => ug.group.kind === "FIR_LEITUNG");
    const VATGERLeader = user.groups.filter((ug) => ug.group.kind === "GLOBAL_VATGER_LEITUNG")
    console.log(user.groups)
    if (firLeadGroups.length > 0) {
      effectiveLevel = "FIR_EVENTLEITER";
    }
    if(VATGERLeader.length > 0 ) effectiveLevel = "VATGER_LEITUNG"
  }

  // =====================================================
  // 3️⃣ FIR-bezogene Rollen bestimmen
  // =====================================================
  const firLevels: Record<string, string> = {}; // z. B. { "EDMM": "FIR_EVENTLEITER" }

  for (const ug of user.groups) {
    const group = ug.group;

    if (!group?.fir?.code) continue;

    if (group.kind === "FIR_LEITUNG") {
      firLevels[group.fir.code] = "FIR_EVENTLEITER";
    } else if (group.kind === "FIR_TEAM" && firLevels[group.fir.code] != "FIR_EVENTLEITER") {
      firLevels[group.fir.code] = "FIR_TEAM";
    }
  }

  // =====================================================
  // 4️⃣ Antwortobjekt zusammenbauen
  // =====================================================
  const responseData = {
    cid: user.cid,
    name: user.name,
    rating: user.rating,
    role: user.role,
    fir: user.fir
      ? { id: user.fir.id, code: user.fir.code, name: user.fir.name }
      : null,
    groups: user.groups.map((ug) => ({
      id: ug.group.id,
      name: ug.group.name,
      kind: ug.group.kind,
      fir: ug.group.fir
        ? { id: ug.group.fir.id, code: ug.group.fir.code, name: ug.group.fir.name }
        : null,
    })),
    effectivePermissions: Array.from(effectivePermissions),
    firScopedPermissions, // FIR-Code → Permissions in dieser FIR
    effectiveLevel, // GLOBAL Level (z. B. FIR_EVENTLEITER)
    firLevels, // FIR-spezifische Rollen
  };

  return NextResponse.json(responseData);
}
