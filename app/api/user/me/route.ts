import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserWithEffectiveData } from "@/lib/acl/policies";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cid = Number(session.user.id);
  const user = await getUserWithEffectiveData(cid);
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Fetch the weekly events the user is responsible for
  const managedWeeklys = await prisma.weeklyEventManager.findMany({
    where: { userCID: cid },
    select: { configId: true },
  });
  const managedWeeklyIds = managedWeeklys.map((m) => m.configId);

  // API-Response im Format deines CurrentUser-Interfaces
  const responseData = {
    cid: user.cid,
    name: user.name,
    rating: user.rating,
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
    effectivePermissions: user.effectivePermissions,
    firScopedPermissions: user.firScopedPermissions,
    effectiveLevel: user.effectiveLevel,
    firLevels: user.firLevels,
    managedWeeklyIds,
  };

  return NextResponse.json(responseData);
}
