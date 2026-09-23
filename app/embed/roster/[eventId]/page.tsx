"use client";

import { use, useEffect, useState } from "react";
import PublicRoster from "@/app/events/[id]/_components/PublicRoster";
import { useSession } from "next-auth/react";

interface EmbedEvent {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  firCode: string | null;
}

function hm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Besetzungsplan pur – zum Einbetten in ATCISS.
 *
 * Kein Login, keine Navigation, kein Footer: Die Seite lebt in einem fremden
 * Fenster und soll dort nichts als den Plan zeigen. Was sie braucht, holt sie
 * über den anmeldefreien Weg; zu sehen ist ausschließlich, was das Event-Team
 * auch veröffentlicht hat.
 *
 * Über `?theme=dark` lässt sich die Darstellung an die einbettende Oberfläche
 * angleichen – ATCISS ist dunkel, der Eventmanager folgt sonst dem System.
 */
export default function EmbeddedRosterPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId: idParam } = use(params);
  const eventId = Number(idParam);
  const [event, setEvent] = useState<EmbedEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const session = useSession();

  useEffect(() => {
    if (isNaN(eventId)) {
      setNotFound(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/events/${eventId}/roster`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (cancelled) return;
        if (!data.event) setNotFound(true);
        else setEvent(data.event as EmbedEvent);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (notFound) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Für dieses Event liegt kein veröffentlichter Besetzungsplan vor.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {event && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b px-3 py-2">
          <span className="text-sm font-semibold">{event.name}</span>
          <span className="text-xs text-muted-foreground">
            {hm(event.startTime)}–{hm(event.endTime)}z
          </span>
          {event.firCode && (
            <span className="text-xs text-muted-foreground">· {event.firCode}</span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">Alle Zeiten UTC</span>
        </div>
      )}
      <PublicRoster
        eventId={eventId}
        userCID={session.data?.user.cid ? Number(session.data?.user?.cid) : null}
        embedded
        source={`/api/public/events/${eventId}/roster`}
      />
    </div>
  );
}
