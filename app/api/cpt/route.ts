import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/acl/permissions';
import { prisma } from '@/lib/prisma';
import {
  attachCptStatus,
  canManageCptResponsibles,
  canManageCptStatus,
  fetchTrainingCpts,
} from '@/lib/cpt/cptService';
import { cptBelongsToFir } from '@/config/cptFirMapping';

/**
 * Liefert die CPTs der Training-API angereichert um FIR-Zuordnung und den
 * lokalen Arbeitsstand (gepostet? Forumslink? Notiz?).
 *
 * Query:
 *  - `fir`: optionaler FIR-Filter (EDMM/EDGG/EDWW)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(await hasAdminAccess(Number(session.user.id)))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cid = Number(session.user.cid ?? session.user.id);
  const firFilter = request.nextUrl.searchParams.get('fir')?.toUpperCase() || null;

  try {
    const cpts = await fetchTrainingCpts();
    const filtered = firFilter
      ? cpts.filter((cpt) => cptBelongsToFir(cpt.position, firFilter))
      : cpts;

    const data = await attachCptStatus(filtered);
    data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Rechte und Verantwortliche gleich mitliefern: Die Oberfläche kommt so
    // mit einem Request aus und muss Berechtigungen nicht selbst herleiten.
    const firCodes = [
      ...new Set(data.map((c) => c.firCode).filter((f): f is string => !!f)),
    ];
    if (firFilter && !firCodes.includes(firFilter)) firCodes.push(firFilter);

    const permissions: Record<string, { canEditStatus: boolean; canEditResponsibles: boolean }> = {};
    await Promise.all(
      firCodes.map(async (code) => {
        permissions[code] = {
          canEditStatus: await canManageCptStatus(cid, code),
          canEditResponsibles: await canManageCptResponsibles(cid, code),
        };
      })
    );

    const responsibleRows = firCodes.length
      ? await prisma.cptResponsible.findMany({
          where: { firCode: { in: firCodes } },
          include: { user: { select: { cid: true, name: true, rating: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const responsibles: Record<
      string,
      { userCID: number; name: string; rating: string | null }[]
    > = {};
    for (const row of responsibleRows) {
      (responsibles[row.firCode] ??= []).push({
        userCID: row.userCID,
        name: row.user?.name ?? `CID ${row.userCID}`,
        rating: row.user?.rating ?? null,
      });
    }

    return NextResponse.json({ data, permissions, responsibles });
  } catch (error) {
    console.error('CPT API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CPT data' },
      { status: 500 }
    );
  }
}
