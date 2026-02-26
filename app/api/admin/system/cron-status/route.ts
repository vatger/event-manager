import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCronJobStatuses, triggerCronJob, toggleCronJobActive } from '@/lib/cron/cronService';
import { isMainAdminCid } from '@/lib/acl/mainAdmins';

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
    if (!isMainAdminCid(Number(session.user.cid))) {
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

/**
 * PATCH /api/admin/system/cron-status
 * Toggle a CRON job's active state
 * Requires MAIN_ADMIN role
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isMainAdminCid(Number(session.user.cid))) {
      return NextResponse.json({ error: 'Forbidden - Main Admin access required' }, { status: 403 });
    }

    const { jobName, isActive } = await request.json();

    if (!jobName || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'jobName and isActive (boolean) are required' }, { status: 400 });
    }

    const result = await toggleCronJobActive(jobName, isActive);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to toggle CRON job active state:', error);
    return NextResponse.json(
      { error: 'Failed to toggle CRON job active state' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system/cron-status
 * Manually trigger a CRON job
 * Requires MAIN_ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is main admin
    if (!isMainAdminCid(Number(session.user.cid))) {
      return NextResponse.json({ error: 'Forbidden - Main Admin access required' }, { status: 403 });
    }

    const { jobName } = await request.json();

    if (!jobName) {
      return NextResponse.json({ error: 'jobName is required' }, { status: 400 });
    }

    const result = await triggerCronJob(jobName);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to trigger CRON job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger CRON job' },
      { status: 500 }
    );
  }
}
