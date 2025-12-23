import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import { authOptions } from "@/lib/auth";
export async function PATCH(request: NextRequest) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  try {
    // Authentifizierung überprüfen
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Aktuellen Benutzer ermitteln
    const userId = Number(session.user.id);

    // Alle Benachrichtigungen des aktuellen Benutzers als gelesen markieren
    const updatedNotifications = await prisma.notification.updateMany({
      where: {
        userCID: userId,
        readAt: null // Nur ungelesene Benachrichtigungen aktualisieren
      },
      data: {
        readAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      count: updatedNotifications.count 
    });
    
  } catch (error) {
    console.error('Fehler beim Markieren aller Benachrichtigungen als gelesen:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' }, 
      { status: 500 }
    );
  }
}