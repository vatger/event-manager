"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, LogIn, RefreshCw } from "lucide-react";
import PublicRoster from "@/app/events/[id]/_components/PublicRoster";

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
 * Keine Navigation, kein Footer: Die Seite lebt in einem fremden Fenster und
 * soll dort nichts als den Plan zeigen. Eine Anmeldung ist trotzdem nötig –
 * der Plan nennt Namen, und wer ihn sieht, soll bekannt sein.
 *
 * Das Anmelden läuft bewusst in einem eigenen Fenster: Die VATSIM-Anmeldung
 * lässt sich nicht einbetten, ein Sprung dorthin im iframe endete in einem
 * leeren Rahmen. Nach der Rückkehr genügt ein Klick auf „Erneut prüfen“, und
 * die Seite holt die Sitzung nach.
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
  const { data: session, status, update } = useSession();
  const [event, setEvent] = useState<EmbedEvent | null>(null);
  const [notFound, setNotFound] = useState(false);

  const authenticated = status === "authenticated";

  useEffect(() => {
    if (!authenticated || isNaN(eventId)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/roster/public`);
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
  }, [eventId, authenticated]);

  /**
   * Läuft die Seite für sich allein oder in einem fremden Rahmen?
   *
   * Von der Eventseite aus wird sie als Vollbild des Plans aufgerufen – dann
   * gehört ein Weg zurück dazu. In ATCISS steckt dieselbe Seite in einem
   * iframe, und dort wäre ein Verweis auf den Eventmanager fehl am Platz: Der
   * Rahmen ist knapp, und die Navigation gehört der einbettenden Anwendung.
   */
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    setStandalone(window.self === window.top);
  }, []);

  // Nach der Anmeldung im anderen Fenster: sobald dieses hier wieder den Fokus
  // bekommt, noch einmal nachsehen – das erspart den Klick auf „Erneut prüfen“.
  const recheck = useCallback(() => void update(), [update]);
  useEffect(() => {
    if (authenticated) return;
    window.addEventListener("focus", recheck);
    return () => window.removeEventListener("focus", recheck);
  }, [authenticated, recheck]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Lade…</p>
      </div>
    );
  }

  if (!authenticated) {
    const target =
      typeof window === "undefined"
        ? "/auth/signin"
        : `/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm font-medium">Besetzungsplan</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Zum Anzeigen ist eine Anmeldung beim VATGER Eventmanager nötig. Sie öffnet sich in
          einem eigenen Fenster.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => window.open(target, "_blank", "noopener")}>
            <LogIn className="mr-1.5 h-3.5 w-3.5" />
            Anmelden
            <ExternalLink className="ml-1.5 h-3 w-3 opacity-70" />
          </Button>
          <Button size="sm" variant="outline" onClick={recheck}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Erneut prüfen
          </Button>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b px-3 py-2">
          {standalone && (
            <Link
              href={`/events/${eventId}`}
              title="Zurück zum Event"
              aria-label="Zurück zum Event"
              className="-ml-1 mr-0.5 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
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
        userCID={session?.user?.cid ? Number(session.user.cid) : null}
        embedded
      />
    </div>
  );
}
