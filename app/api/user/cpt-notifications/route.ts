import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/cpt-notifications
 * Get the current user's CPT notification preference
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma?.user.findUnique({
      where: { cid: Number(session.user.id) },
      select: { cptNotificationsEnabled: true },
    });

    return NextResponse.json({ 
      enabled: user?.cptNotificationsEnabled || false 
    });
  } catch (error) {
    console.error('Error fetching CPT notification preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/cpt-notifications
 * Update the current user's CPT notification preference
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const user = await prisma?.user.update({
      where: { cid: Number(session.user.id) },
      data: { cptNotificationsEnabled: enabled },
    });

    return NextResponse.json({ 
      enabled: user?.cptNotificationsEnabled || false 
    });
  } catch (error) {
    console.error('Error updating CPT notification preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
