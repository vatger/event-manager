import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCronJobStatuses } from '@/lib/cron/cronService';

/**
 * GET /api/admin/system/cron-status
 * Get status of all CRON jobs
 * Requires MAIN_ADMIN role
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is main admin
    if (session.user.role !== 'MAIN_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Main Admin access required' }, { status: 403 });
    }

    const statuses = await getCronJobStatuses();

    return NextResponse.json(statuses);
  } catch (error) {
    console.error('[API] Failed to get CRON job statuses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CRON job statuses' },
      { status: 500 }
    );
  }
}
