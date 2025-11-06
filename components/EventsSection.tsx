"use client";

import { motion } from "framer-motion";
import EventCard from "./EventCard";
import { Event } from "@/types";

interface EventsSectionProps {
  events: Event[];
  onSelect: (event: Event) => void;
}

export default function EventsSection({ events, onSelect }: EventsSectionProps) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <EventCard event={event} showBanner/>
        </motion.div>
      ))}
    </div>
  );
}
