"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { EventCard } from "./_components/EventCard";
import Protected from "@/components/Protected";
import AdminEventForm from "./_components/AdminEventForm";

interface Event {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  airport: string;
  startTime: string;
  endTime: string;
  staffedStations: string[];
  signupDeadline: string;
  registrations: number;
  status: string;
}

export default function AdminEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Events aus API laden
  async function refreshEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch events", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshEvents();
  }, []);

  const handleCreate = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    refreshEvents();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const d = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const dd = await d.json()
    console.log(dd)
    refreshEvents();
  };

  return (
    <Protected>
    <div className="container mx-auto py-12 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Event Management</h1>
        <Button onClick={handleCreate}>+ New Event</Button>
      </div>

      {loading ? (
        <p>⏳ Lade Events...</p>
      ) : events.length === 0 ? (
        <p>Keine Events gefunden</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={() => handleEdit(event)}
              onDelete={() => handleDelete(event.id)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      <AdminEventForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        onSuccess={refreshEvents}
      />
    </div>
    </Protected>
  );
}
