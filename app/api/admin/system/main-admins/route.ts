import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMainAdminCids } from '@/lib/acl/mainAdmins';

/**
 * GET /api/admin/system/main-admins
 * Returns the list of main admins from the MAIN_ADMIN_CIDS env variable.
 * Requires MAIN_ADMIN role.
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'MAIN_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const mainAdminCids = getMainAdminCids();

  const users = await prisma.user.findMany({
    where: { cid: { in: mainAdminCids } },
    select: { cid: true, name: true, rating: true },
  });

  // Preserve the order defined in the env var and include CIDs not yet in DB
  const admins = mainAdminCids.map((cid) => {
    const user = users.find((u) => u.cid === cid);
    return { cid, name: user?.name ?? null, rating: user?.rating ?? null };
  });

  return NextResponse.json(admins);
}
