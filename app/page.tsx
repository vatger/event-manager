"use client";

import { useEffect, useMemo, useState } from "react";
import EventsSection from "@/components/EventsSection";
import { useSession } from "next-auth/react";

interface Events {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  airports: string;
  startTime: string;
  endTime: string;
  staffedStations: string[];
  signupDeadline: string;
  registrations: number;
  status: string;
  isSignedUp?: boolean;
}

export default function EventsPage() {
  const { data: session } = useSession();
  const [selectedEvent, setSelectedEvent] = useState<Events | null>(null);
  const [events, setEvents] = useState<Events[]>([]);
  
  useEffect(() => {
    async function loadEvents() {
      const url = session?.user?.id ? `/api/events?userCID=${session.user.id}` : "/api/events";
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data);
    }
    loadEvents();
  }, [session?.user?.id]);

  const [signedUpEvents, upcomingEvents, pastEvents] = useMemo(() => {
    const now = new Date().toISOString();
    const visible = events.filter((e: Events) => e.status !== "DRAFT");
    
    const signed = visible.filter((e: Events) => e.isSignedUp);
    const upcoming = visible.filter((e: Events) => !e.isSignedUp && e.endTime > now);
    const past = visible
      .filter((e: Events) => e.endTime <= now)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
    
    return [signed, upcoming, past];
  }, [events]);

  const handleSelect = (event: Events) => {
    if (event.status === "SIGNUP_OPEN") setSelectedEvent(event);
  };

  return (
    <div className="container mx-auto py-12 space-y-12 p-3">
      {signedUpEvents.length > 0 && (
        <div>
          <h2 className="text-3xl font-semibold mb-6 text-center">Deine Anmeldungen</h2>
          <EventsSection events={signedUpEvents} onSelect={handleSelect} />
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <div>
          <h2 className="text-3xl font-semibold mb-6 text-center">Bevorstehende Events</h2>
          <EventsSection events={upcomingEvents} onSelect={handleSelect} />
        </div>
      )}

      {pastEvents.length > 0 && (
        <div>
          <h2 className="text-3xl font-semibold mb-6 text-center">Vergangene Events</h2>
          <EventsSection 
            events={pastEvents} 
            onSelect={handleSelect}
          />
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center text-gray-500 mt-12">
          <p>Keine Events verfügbar.</p>
        </div>
      )}
    </div>
  );
}