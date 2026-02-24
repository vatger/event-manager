import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { userHasFirPermission } from '@/lib/acl/permissions';

/**
 * POST /api/weeklys/[id]/occurrences/[occurrenceId]/signup-by-cid
 * Add a signup for another user by CID
 * Requires signups.manage or event.manage permission in the FIR
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occurrenceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, occurrenceId: occurrenceIdParam } = await params;
    const configId = parseInt(id);
    const occurrenceId = parseInt(occurrenceIdParam);

    if (isNaN(configId) || isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get the weekly config and occurrence
    const occurrence = await prisma.weeklyOccurrence.findUnique({
      where: { id: occurrenceId },
      include: {
        config: {
          include: {
            fir: true,
          },
        },
      },
    });

    if (!occurrence || occurrence.configId !== configId) {
      return NextResponse.json({ error: 'Occurrence not found' }, { status: 404 });
    }

    if (!occurrence.config.fir) {
      return NextResponse.json({ error: 'FIR not found for this event' }, { status: 404 });
    }

    const firCode = occurrence.config.fir.code;

    // Check permission
    const hasSignupsManage = await userHasFirPermission(session.user.cid, firCode, 'signups.manage');
    const hasEventManage = await userHasFirPermission(session.user.cid, firCode, 'event.manage');

    if (!hasSignupsManage && !hasEventManage) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Requires signups.manage or event.manage in this FIR' },
        { status: 403 }
      );
    }

    // Parse request body
    const { userCID, remarks } = await request.json();

    if (!userCID) {
      return NextResponse.json({ error: 'userCID is required' }, { status: 400 });
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { userCID },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found with this CID' }, { status: 404 });
    }

    // Check if user is already signed up
    const existingSignup = await prisma.weeklySignup.findUnique({
      where: {
        occurrenceId_userCID: {
          occurrenceId,
          userCID,
        },
      },
    });

    if (existingSignup) {
      return NextResponse.json({ error: 'User is already signed up for this occurrence' }, { status: 409 });
    }

    // Create the signup
    const signup = await prisma.weeklySignup.create({
      data: {
        occurrenceId,
        userCID,
        remarks: remarks || null,
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json({
      message: 'Signup created successfully',
      signup,
    });
  } catch (error) {
    console.error('[API] Failed to add signup by CID:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
