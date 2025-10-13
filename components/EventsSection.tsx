"use client";

import { motion } from "framer-motion";
import EventCard from "./EventCard";

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
interface EventsSectionProps {
  events: Events[];
  onSelect: (event: Events) => void;
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
          <EventCard event={event} onClick={() => onSelect(event)} />
        </motion.div>
      ))}
    </div>
  );
}
