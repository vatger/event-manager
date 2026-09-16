import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Besetzungspläne, die ATCISS gerade einblenden soll.
 *
 * ATCISS fragt je FIR: „Läuft hier demnächst oder gerade ein Event mit einem
 * veröffentlichten Plan?" Ist das der Fall, kommt der Link zur eingebetteten
 * Ansicht zurück, sonst nichts – eine leere Antwort ist die normale Antwort
 * und kein Fehler.
 *
 * Das Fenster reicht von einer Stunde vor dem Event bis eine Stunde danach:
 * vorher, damit die Ablösung schon weiß, was kommt, nachher, weil sich die
 * letzte Schicht erfahrungsgemäß zieht.
 */

/** Vorlauf und Nachlauf um den Eventzeitraum */
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Öffentliche Adresse dieser Instanz.
 *
 * Der Link muss von außen aufrufbar sein – aus der Anfrage selbst lässt er
 * sich hinter einem Reverse Proxy nicht zuverlässig ableiten, deshalb zuerst
 * die Konfiguration und erst danach der Host der Anfrage.
 */
function baseUrl(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fir = searchParams.get("fir")?.trim().toUpperCase() || null;

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      status: "ROSTER_PUBLISHED",
      ...(fir ? { firCode: fir } : {}),
      // Event läuft, beginnt in der nächsten Stunde oder ist vor höchstens
      // einer Stunde zu Ende gegangen.
      startTime: { lte: new Date(now.getTime() + WINDOW_MS) },
      endTime: { gte: new Date(now.getTime() - WINDOW_MS) },
    },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      firCode: true,
      airports: true,
      roster: { select: { id: true, publishedAt: true, publishedData: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const base = baseUrl(req);
  const rosters = events
    // Veröffentlicht heißt noch nicht, dass auch jemand eingeteilt ist. Ein
    // leerer Plan hilft in ATCISS niemandem.
    .filter((e) => {
      const data = e.roster?.publishedData as { assignments?: unknown[] } | null | undefined;
      return Array.isArray(data?.assignments) && data.assignments.length > 0;
    })
    .map((e) => ({
      eventId: e.id,
      name: e.name,
      fir: e.firCode,
      airports: Array.isArray(e.airports) ? (e.airports as string[]) : [],
      startTime: e.startTime,
      endTime: e.endTime,
      publishedAt: e.roster?.publishedAt ?? null,
      /** Fertige Adresse für das iframe */
      url: `${base}/embed/roster/${e.id}`,
    }));

  return NextResponse.json(
    { rosters },
    {
      headers: {
        // ATCISS fragt regelmäßig nach; eine Minute Zwischenspeicher nimmt
        // Last, ohne dass ein frisch veröffentlichter Plan lange ausbleibt.
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
