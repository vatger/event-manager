"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Event, Signup } from "@/types";
import EventHeader from "./_components/EventHeader";
import StatsCard from "./_components/StatsCard";
import AvailabilityTimeline from "./_components/AvailabilityTimeline";
import SignupsTableCard from "./_components/SignupTableCard";
import SyncToSheetsButton from "@/app/admin/_components/SyncToSheetsButton";

export default function AdminEventSignupsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string>("");

  const [signups, setSignups] = useState<Signup[]>([]);
  const [signupsLoading, setSignupsLoading] = useState<boolean>(false);
  const [signupsError, setSignupsError] = useState<string>("");

  // Event laden
  useEffect(() => {
    if (!eventId) return;
    setEventLoading(true);
    setEventError("");

    fetch(`/api/events/${eventId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Fehler beim Laden des Events");
        }
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => setEventError(err.message || "Fehler beim Laden des Events"))
      .finally(() => setEventLoading(false));
  }, [eventId]);

  // Signups laden
  const loadSignups = () => {
    if (!eventId) return;
    setSignupsLoading(true);
    setSignupsError("");

    fetch(`/api/events/${eventId}/signup`)
      .then((res) => {
        if (!res.ok) throw new Error("Fehler beim Laden der Anmeldungen");
        return res.json();
      })
      .then((data) => setSignups(data))
      .catch((err) => setSignupsError("Fehler beim Laden der Anmeldungen"))
      .finally(() => setSignupsLoading(false));
  };

  useEffect(() => {
    loadSignups();
  }, [eventId]);

  // Slots für Timeline generieren
  const slots = useMemo(() => generateHalfHourSlotsUTC(event?.startTime, event?.endTime), [event?.startTime, event?.endTime]);

  if (eventLoading) return <div className="flex justify-center items-center h-64 text-muted-foreground">Lade Event...</div>;
  if (eventError || !event) return <div className="p-6 text-center text-red-500">{eventError || "Event nicht gefunden"}</div>;

  return (
    <div className="p-6 space-y-6">
      <EventHeader 
        event={event} 
        onRefresh={loadSignups} 
        loading={signupsLoading} 
      />
      
      <StatsCard signups={signups} event={event} />
      
      <AvailabilityTimeline 
        signups={signups} 
        slots={slots} 
        loading={signupsLoading} 
        error={signupsError}
        event={event}
      />
      
      <SignupsTableCard
        signups={signups}
        event={event}
        loading={signupsLoading}
        error={signupsError}
        onRefresh={loadSignups}
      />
      <SyncToSheetsButton eventId={parseInt(event.id.toString())} />
    </div>
  );
}

// Helper function (kann später in separate utils Datei ausgelagert werden)
function generateHalfHourSlotsUTC(startIso?: string, endIso?: string): { slotStart: string; slotEnd: string }[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  const t = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()));
  
  const minutes = t.getUTCMinutes();
  if (minutes % 30 !== 0) {
    const delta = 30 - (minutes % 30);
    t.setUTCMinutes(minutes + delta);
  }
  
  const result: { slotStart: string; slotEnd: string }[] = [];
  while (t < end) {
    const slotStart = new Date(t);
    t.setUTCMinutes(t.getUTCMinutes() + 30);
    const slotEnd = new Date(t);
    
    if (slotEnd <= end) {
      const startHH = String(slotStart.getUTCHours()).padStart(2, "0");
      const startMM = String(slotStart.getUTCMinutes()).padStart(2, "0");
      const endHH = String(slotEnd.getUTCHours()).padStart(2, "0");
      const endMM = String(slotEnd.getUTCMinutes()).padStart(2, "0");
      
      result.push({
        slotStart: `${startHH}:${startMM}`,
        slotEnd: `${endHH}:${endMM}`
      });
    }
  }
  return result;
}
