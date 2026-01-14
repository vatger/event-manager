import { getSessionUser } from '@/lib/getSessionUser';
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server';

export async function GET() {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  try {
    const meta = await prisma.trainingCacheMetadata.findFirst()
    
    if (!meta) {
      return Response.json({ 
        lastUpdated: null,
        message: 'Cache noch nie aktualisiert'
      })
    }
    
    return Response.json({ 
      lastUpdated: meta.lastUpdated.toISOString(),
      forceUpdate: meta.forceUpdate
    })
  } catch (err: unknown) {
    console.error('Failed to fetch cache status', err)
    return new Response(JSON.stringify({ 
      success: false, 
      error: err instanceof Error ? err.message : 'unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
