"use client";

import { useEffect, useState } from "react";
import EventCard from "@/components/EventCard";
import SignupForm from "@/components/SignupForm";
import { motion, AnimatePresence } from "framer-motion";


export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadEvents() {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data);
    }
    loadEvents();
  }, []);

  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold mb-10 text-center">Upcoming Events</h1>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <EventCard
              event={event}
              onClick={() =>
                event.status === "controlleranmeldung" && setSelectedEvent(event)
              }
            />
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <SignupForm
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
