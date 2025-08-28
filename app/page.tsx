"use client";

import { useEffect, useMemo, useState } from "react";
import SignupForm from "@/components/SignupForm";
import { AnimatePresence } from "framer-motion";
import EventsSection from "@/components/EventsSection";
import { useSession } from "next-auth/react";

export default function EventsPage() {
  const { data: session } = useSession();
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  
  useEffect(() => {
    async function loadEvents() {
      const url = session?.user?.id ? `/api/events?userCID=${session.user.id}` : "/api/events";
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data);
    }
    loadEvents();
  }, [session?.user?.id]);

  
  const [signedUpEvents, upcomingEvents] = useMemo(() => {
    const signed = events.filter((e: any) => e.isSignedUp);
    const upcoming = events.filter((e: any) => !e.isSignedUp);
    return [signed, upcoming];
  }, [events]);

  const handleSelect = (event: any) => {
    if (event.status === "SIGNUP_OPEN") setSelectedEvent(event);
  };

  return (
    <div className="container mx-auto py-12 space-y-12">
      {signedUpEvents.length > 0 && (
        <div>
          <h2 className="text-3xl font-semibold mb-6 text-center">Deine Anmeldungen</h2>
          <EventsSection events={signedUpEvents} onSelect={handleSelect} />
        </div>
      )}

      <div>
        <h2 className="text-3xl font-semibold mb-6 text-center">Bevorstehende Events</h2>
        <EventsSection events={upcomingEvents} onSelect={handleSelect} />
      </div>
    </div>
  );
}
