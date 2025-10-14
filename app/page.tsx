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
    
    const signed = visible
      .filter((e: Events) => e.isSignedUp && e.endTime >= now);
    const upcoming = visible.filter((e: Events) => !e.isSignedUp && e.endTime > now);
    const past = visible
      .filter((e: Events) => e.endTime <= now)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
    
    return [signed, upcoming, past];
  }, [events]);

  const handleSelect = (event: Events) => {
    if (event.status === "SIGNUP_OPEN") setSelectedEvent(event);
  };

  const [timeUntilNextEvent, setTimeUntilNextEvent] = useState('');

  useEffect(() => {
    if (signedUpEvents.length > 0) {
      // Finde das nächste Event an dem der User angemeldet ist
      const nextEvent = signedUpEvents
        .filter(event => new Date(event.startTime) > new Date())
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

      if (nextEvent) {
        const updateCountdown = () => {
          const now = new Date();
          const eventTime = new Date(nextEvent.startTime);
          const diff = eventTime.getTime() - now.getTime();

          if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
              setTimeUntilNextEvent(`${days} Tag${days !== 1 ? 'en' : ''}`);
            } else if (hours > 0) {
              setTimeUntilNextEvent(`${hours} Std ${minutes} Min`);
            } else {
              setTimeUntilNextEvent(`${minutes} Minuten`);
            }
          } else {
            setTimeUntilNextEvent('Event startet bald!');
          }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute
        return () => clearInterval(interval);
      }
    }
  }, [signedUpEvents]);

  return (
    <div className="container mx-auto py-8 space-y-12 p-3">
      {/* Subheader mit Countdown */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Willkommen{session?.user?.name && `, ${session.user.name.split(' ')[0]}`}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Melde dich hier für Events der FIR München an.
        </p>
        
        {/* Quick Stats mit Countdown */}
        <div className="flex justify-center gap-6 pt-4 flex-wrap">
          {signedUpEvents.length > 0 && timeUntilNextEvent && (
            <div className="bg-gradient-to-br from-blue-900 to-blue-300 text-white px-6 py-3 rounded-lg shadow-lg">
              <div className="text-sm font-medium">Dein nächstes Event in</div>
              <div className="text-2xl font-bold">{timeUntilNextEvent}</div>
            </div>
          )}
        </div>
      </div>
  
      {/* Event Sections */}
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