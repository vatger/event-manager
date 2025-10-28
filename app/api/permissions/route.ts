import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hole alle verfügbaren Permissions aus der Datenbank
    const permissions = await prisma.permission.findMany({
      select: {
        id: true,
        key: true,
        description: true,
      },
      orderBy: {
        key: 'asc'
      }
    });

    return NextResponse.json(permissions);

  } catch (error) {
    console.error("❌ GET permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}