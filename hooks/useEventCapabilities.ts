"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useUser } from "@/hooks/useUser";
import {
  computeEventCapabilities,
  type EventCapabilities,
} from "@/lib/events/eventCapabilities";

const NONE: EventCapabilities = {
  editDetails: false,
  delete: false,
  banner: false,
  signupPhase: false,
  publishRoster: false,
  editRoster: false,
  manageSignups: false,
  export: false,
  notify: false,
  manageTasks: false,
  manageResponsibles: false,
  selfAssign: false,
  isTeamMember: false,
  isResponsible: false,
  viewLog: false,
};

async function fetchCapabilities(url: string): Promise<EventCapabilities> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Rechte konnten nicht geladen werden");
  return res.json();
}

/**
 * Was der angemeldete Nutzer an diesem Event darf – vom Server berechnet,
 * dieselben Werte prüft die API. Bis die Antwort da ist, ist alles gesperrt.
 * Mehrere Komponenten derselben Seite teilen sich eine Anfrage.
 */
export function useEventCapabilities(eventId: number | string | null | undefined) {
  const { data, isLoading, mutate } = useSWR<EventCapabilities>(
    eventId ? `/api/events/${eventId}/permissions` : null,
    fetchCapabilities,
    { revalidateOnFocus: false }
  );
  return { capabilities: data ?? NONE, loading: isLoading, reload: () => mutate() };
}

/**
 * Dieselbe Berechnung ohne Anfrage – für Listen, in denen jedes Event eine
 * eigene Abfrage bräuchte. Kennt die ausdrücklichen Roster-Bearbeiter nicht.
 */
export function useEventCapabilitiesFor(event: {
  firCode?: string | null;
  responsibles?: Array<{ cid: number }> | null;
}): EventCapabilities {
  const { user } = useUser();
  return useMemo(() => {
    if (!user) return NONE;
    return computeEventCapabilities(user, {
      firCode: event.firCode ?? null,
      isResponsible: (event.responsibles ?? []).some((r) => r.cid === user.cid),
      isRosterEditor: false,
    });
  }, [user, event.firCode, event.responsibles]);
}
