"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CalendarClock, Loader2 } from "lucide-react";
import { parseEventAirports } from "@/lib/multiAirport";
import type { SignupTableEntry } from "@/lib/cache/types";
import type { Station } from "@/lib/stations/types";
import type { StationGroup } from "@/lib/weeklys/stationUtils";
import type { ApiRoster, StationMeta } from "./_lib/rosterTypes";
import { RosterSetup } from "./_components/RosterSetup";
import { RosterEditor } from "./_components/RosterEditor";

interface ApiEvent {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  airports: unknown;
  staffedStations: unknown;
  signupSlotMinutes?: number | null;
  firCode?: string | null;
  status: string;
}

const statusLabels: Record<string, string> = {
  DRAFT: "Entwurf",
  PLANNING: "Planung",
  SIGNUP_OPEN: "Anmeldung offen",
  SIGNUP_CLOSED: "Anmeldung geschlossen",
  ROSTER_PUBLISHED: "Roster veröffentlicht",
  CANCELLED: "Abgesagt",
};

export default function EventRosterPage() {
  const params = useParams();
  const eventId = Number(params.id);

  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [roster, setRoster] = useState<ApiRoster | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canManageEditors, setCanManageEditors] = useState(false);
  const [canManageSignups, setCanManageSignups] = useState(false);
  const [signups, setSignups] = useState<SignupTableEntry[]>([]);
  const [stationMetaMap, setStationMetaMap] = useState<Map<string, StationMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [eventRes, rosterRes, signupsRes, stationsRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/roster`),
        fetch(`/api/events/${eventId}/signup/full`),
        fetch(`/api/stations`),
      ]);

      if (rosterRes.status === 403) {
        setError("Du hast keine Berechtigung, den Besetzungsplan dieses Events zu sehen.");
        return;
      }
      if (!eventRes.ok || !rosterRes.ok) throw new Error("Fehler beim Laden");

      const eventData = await eventRes.json();
      const rosterData = await rosterRes.json();
      setEvent(eventData);
      setRoster(rosterData.roster);
      setCanEdit(Boolean(rosterData.canEdit));
      setCanManageEditors(Boolean(rosterData.canManageEditors));
      setCanManageSignups(Boolean(rosterData.canManageSignups));

      if (signupsRes.ok) {
        const s = await signupsRes.json();
        setSignups(Array.isArray(s.signups) ? s.signups : []);
      }
      if (stationsRes.ok) {
        const s = await stationsRes.json();
        const map = new Map<string, StationMeta>();
        for (const st of (s.stations ?? []) as Station[]) {
          map.set(st.callsign.toUpperCase(), {
            group: st.group === "Sonstiges" ? null : (st.group as StationGroup),
            airport: st.airport ?? null,
            s1Twr: st.s1Twr === true,
          });
        }
        setStationMetaMap(map);
      }
      setError(null);
    } catch (err) {
      console.error("[Roster] Fehler beim Laden:", err);
      setError("Fehler beim Laden der Roster-Daten");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!isNaN(eventId)) load();
  }, [eventId, load]);

  // Leichtgewichtiger Reload nur des Rosters (Realtime-Sync, Dialog-Updates)
  const reloadRoster = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/roster`);
      if (!res.ok) return;
      const data = await res.json();
      setRoster(data.roster);
      setCanEdit(Boolean(data.canEdit));
      setCanManageEditors(Boolean(data.canManageEditors));
      setCanManageSignups(Boolean(data.canManageSignups));
    } catch (err) {
      console.error("[Roster] Reload fehlgeschlagen:", err);
    }
  }, [eventId]);

  // Roster + Signups neu laden (nach Signup-Änderungen)
  const reloadAll = useCallback(async () => {
    await load();
  }, [load]);

  const eventAirports = useMemo(
    () => (event ? parseEventAirports(event.airports) : []),
    [event]
  );
  const staffedStations = useMemo(() => {
    if (!event || !Array.isArray(event.staffedStations)) return [];
    return (event.staffedStations as unknown[]).filter(
      (s): s is string => typeof s === "string"
    );
  }, [event]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Lade Besetzungsplan…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error ?? "Event nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Full-Screen-Editor sobald ein Roster existiert (rendert eigenes Overlay)
  if (roster) {
    return (
      <RosterEditor
        event={{
          id: event.id,
          name: event.name,
          startTime: event.startTime,
          endTime: event.endTime,
          airports: eventAirports,
          firCode: event.firCode ?? undefined,
          signupSlotMinutes: event.signupSlotMinutes ?? undefined,
          status: event.status,
        }}
        roster={roster}
        signups={signups}
        stationMetaMap={stationMetaMap}
        canEdit={canEdit}
        canManageEditors={canManageEditors}
        canManageSignups={canManageSignups}
        onReload={reloadRoster}
        onReloadAll={reloadAll}
        onEventStatusChanged={(status) => setEvent((e) => (e ? { ...e, status } : e))}
      />
    );
  }

  // Setup-Schritt (kein Roster) innerhalb des Admin-Layouts
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Besetzungsplan
          </h1>
          <p className="text-sm text-muted-foreground">
            {event.name} • {eventAirports.join(", ")}
          </p>
        </div>
        <Badge variant="outline">{statusLabels[event.status] ?? event.status}</Badge>
      </div>

      {canEdit ? (
        <RosterSetup
          eventId={event.id}
          eventAirports={eventAirports}
          staffedStations={staffedStations}
          defaultSlotMinutes={event.signupSlotMinutes ?? 30}
          onCreated={load}
        />
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Für dieses Event wurde noch kein Besetzungsplan angelegt.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
