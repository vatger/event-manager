import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { userHasOwnFirPermission } from '@/lib/acl/permissions';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user has permission to search users for notifications in their FIR
  const hasPermission = await userHasOwnFirPermission(Number(session.user.cid), "user.notif");
  if (!hasPermission) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const searchTerm = query.trim();
    
    // Build OR conditions based on search term
    const orConditions: Array<{ name?: { contains: string }; cid?: number }> = [
      { name: { contains: searchTerm } }
    ];
    
    // Only add CID search if searchTerm is numeric
    if (!isNaN(Number(searchTerm))) {
      orConditions.push({ cid: Number(searchTerm) });
    }
    
    // Search by CID or name
    const users = await prisma.user.findMany({
      where: {
        OR: orConditions
      },
      select: {
        cid: true,
        name: true,
        rating: true
      },
      take: 50,
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
