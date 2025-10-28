import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrSetCache, deleteCache } from "@/lib/cache";
import { getEffectiveLevel } from "@/lib/acl/policies";

function userCacheKey(cid: number) {
  return `user:${cid}`;
}

// 🔹 Cache löschen (bei Rechteänderungen etc.)
export async function invalidateUserCache(cid: number) {
  deleteCache(userCacheKey(cid));
}

// 🔹 Haupt-Handler
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cid = Number(session.user.id);

    // ⏱ Cache nutzen
    const result = await getOrSetCache(userCacheKey(cid), async () => {
      const user = await prisma.user.findUnique({
        where: { cid },
        include: {
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

      if (!user) throw new Error("User not found");

      const effectiveLevel = await getEffectiveLevel(cid);
      const allPermissions = new Set<string>();

      for (const ug of user.groups) {
        for (const gp of ug.group.permissions) {
          allPermissions.add(gp.permission.key);
        }
      }

      if (user.role === "MAIN_ADMIN") {
        allPermissions.add("fir.manage");
        allPermissions.add("event.create");
        allPermissions.add("event.delete");
      }

      return {
        id: user.id,
        cid: user.cid,
        name: user.name,
        rating: user.rating,
        role: user.role,
        firMemberships: user.groups.map((ug) => ({
          fir: ug.group.fir
            ? { id: ug.group.fir.id, code: ug.group.fir.code, name: ug.group.fir.name }
            : null,
          group: { id: ug.group.id, name: ug.group.name, kind: ug.group.kind },
        })),
        effectivePermissions: Array.from(allPermissions),
        effectiveLevel,
        updatedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (error) {
    console.error("❌ /api/user/me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
