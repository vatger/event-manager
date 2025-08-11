import { NextRequest, NextResponse } from 'next/server';
import cfg from '@/data/airport_rules.json'; // Pfad ggf. anpassen
import { canUserStaff } from '@/data/canUserStaff'; // Pfad ggf. anpassen

export async function POST(req: NextRequest) {
  try {
    const { icao, position, user } = await req.json();

    if (!icao || !position || !user) {
      return NextResponse.json(
        { error: 'icao, position, user im Body angeben' },
        { status: 400 }
      );
    }

    const result = canUserStaff(icao, position, user, cfg);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}
