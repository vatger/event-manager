import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const searchTerm = query.trim();
    
    // Search by CID or name
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { cid: isNaN(Number(searchTerm)) ? undefined : Number(searchTerm) },
          { name: { contains: searchTerm, mode: 'insensitive' } }
        ].filter(Boolean)
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
