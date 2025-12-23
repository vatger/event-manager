import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAirportTier1 } from '@/utils/configUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  if (!prisma) {
    return new Response("Service unavailable", { status: 503 });
  }
  try {
    const { eventId: id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Ungültige Event-ID' }, { status: 400 });
    }

    // Event-Daten abfragen
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        airports: true,
        firCode: true,
        signups: {
          where: {
            deletedAt: null  // Exclude soft-deleted signups
          },
          select: { userCID: true }
        }
      }
    });

    if (!event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
    }

    // Prüfe Tier-1 Airport
    const airports = event.airports as string[];
    const isTier1 = airports.some(ap => isAirportTier1(ap));
    
    if (!isTier1) {
      return NextResponse.json({ 
        event: null, 
        candidates: [], 
        isTier1: false 
      });
    }

    // Erstelle alle möglichen Positionen für die Event-Airports
    const allGndPositions = airports.flatMap(ap => 
      [`${ap}_GND`, `${ap}_GNDDEL`]
    );
    
    const allOtherPositions = airports.flatMap(ap => 
      ['TWR', 'APP', 'CTR'].map(suffix => `${ap}_${suffix}`)
    );

    const allPositions = [...allGndPositions, ...allOtherPositions];

    // Sammle alle relevanten Daten parallel
    const [endorsements, solos, familiarizations] = await Promise.all([
      // Endorsements für Event-Airports
      prisma.trainingEndorsementCache.findMany({
        where: {
          position: {
            in: allPositions
          }
        },
        select: { 
          id: true,
          userCID: true, 
          position: true,
          createdAt: true
        }
      }),

      // Solo-Cache für Event-Airports und FIR-basierte CTR Solos
      prisma.trainingSoloCache.findMany({
        where: {
          OR: [
            // Airport-basierte Solos
            {
              position: {
                in: allPositions
              }
            },
            // FIR-basierte CTR Solos (z.B. EDMM_STA_CTR)
            ...(event.firCode ? [{
              AND: [
                { position: { contains: '_CTR' } },
                { position: { startsWith: event.firCode } }
              ]
            }] : [])
          ],
          expiry: { gt: new Date() }
        },
        select: { 
          id: true,
          userCID: true, 
          position: true,
          expiry: true
        }
      }),

      // Familiarization für Event-FIR (nur für CTR)
      event.firCode ? prisma.trainingFamiliarizationCache.findMany({
        where: { sectorFir: event.firCode },
        select: { 
          id: true,
          userCID: true, 
          sectorName: true,
          sectorFir: true
        }
      }) : Promise.resolve([])
    ]);

    // Sammle alle eindeutigen User-CIDs
    const allUserCIDs = [
      ...new Set([
        ...endorsements.map(e => e.userCID),
        ...solos.map(s => s.userCID),
        ...familiarizations.map(f => f.userCID)
      ])
    ];

    // Hole User-Daten für alle gefundenen CIDs
    const users = await prisma.user.findMany({
      where: {
        cid: { in: allUserCIDs }
      },
      select: { 
        cid: true, 
        name: true,
        rating: true
      }
    });

    // Gruppiere Familiarizations pro User
    const famsByUser = new Map<number, string[]>();
    familiarizations.forEach(fam => {
      if (!famsByUser.has(fam.userCID)) {
        famsByUser.set(fam.userCID, []);
      }
      famsByUser.get(fam.userCID)!.push(fam.sectorName);
    });

    // Verarbeite Kandidaten-Daten
    const candidates = allUserCIDs.map(cid => {
      const user = users.find(u => u.cid === cid);
      const userEndorsements = endorsements.filter(e => e.userCID === cid);
      const userSolos = solos.filter(s => s.userCID === cid);
      const userFams = famsByUser.get(cid) || [];

      // Hilfsfunktion zur Bestimmung der Gruppe basierend auf Position
      const getGroupForPosition = (position: string): string | null => {
        if (position.endsWith('_GND') || position.endsWith('_GNDDEL')) return 'GND';
        if (position.endsWith('_TWR')) return 'TWR';
        if (position.endsWith('_APP')) return 'APP';
        if (position.endsWith('_CTR')) return 'CTR';
        
        // Für FIR-basierte CTR Solos (z.B. EDMM_STA_CTR)
        if (position.includes('_CTR') && event.firCode && position.startsWith(event.firCode)) {
          return 'CTR';
        }
        
        return null;
      };

      type GroupData = {
        qualifications: Array<{
          type: 'endorsement' | 'solo';
          position: string;
          id: number;
          expiry?: string;
        }>;
        familiarizations?: string[];
      };
      
      // Gruppiere Qualifikationen nach Positionstyp mit korrekter Typisierung
      const groupData: Record<string, GroupData> = {
        GND: { qualifications: [] },
        TWR: { qualifications: [] },
        APP: { qualifications: [] },
        CTR: { qualifications: [], familiarizations: [] }
      };

      // Verarbeite Endorsements
      userEndorsements.forEach(endorsement => {
        const group = getGroupForPosition(endorsement.position);
        if (group && group in groupData) {
            groupData[group].qualifications.push({
                type: 'endorsement' as const,
                position: endorsement.position,
                id: endorsement.id
            });
        } 
        });

      // Verarbeite Solos
      userSolos.forEach(solo => {
        const group = getGroupForPosition(solo.position);
        if (group && group in groupData) {
            groupData[group].qualifications.push({
                type: 'solo' as const,
                position: solo.position,
                expiry: solo.expiry.toISOString(),
                id: solo.id
            });
        }
        });

      // Familiarizations nur für CTR
      if (userFams.length > 0) {
        groupData.CTR.familiarizations = userFams;
      }

      return {
        cid,
        name: user?.name || null,
        rating: user?.rating || null,
        signedUp: event.signups.some(signup => signup.userCID === cid),
        groups: groupData
      };
    });

    return NextResponse.json({
      event: {
        id: event.id,
        name: event.name,
        airports: airports,
        firCode: event.firCode
      },
      candidates,
      isTier1: true
    });

  } catch (error) {
    console.error('Fehler beim Laden der Kandidaten:', error);
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    );
  }
}