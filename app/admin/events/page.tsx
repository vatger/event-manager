"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Trash2, Edit, Eye } from "lucide-react";

interface Event {
  id: string;
  name: string;
  description?: string;
  signupDeadline: string;
  registrations: number;
}

export default function AdminEventsPage() {
    const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    airport: "",
    startTime: "",
    endTime: "",
    signupDeadline: "",
    googleSheetId: "",
    createdBy: "Admin",
  });

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

  // Beim Laden einmal fetchen
  useEffect(() => {
    refreshEvents();
  }, []);

  async function createEvent() {
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEvent.name,
          airport: newEvent.airport,
          startTime: new Date(newEvent.startTime).toISOString(),
        endTime: new Date(newEvent.endTime).toISOString(),
        signupDeadline: new Date(newEvent.signupDeadline).toISOString(),
          googleSheetId: newEvent.googleSheetId,
          createdBy: "Admin",
        }),
      });
  
      if (!res.ok) throw new Error("Failed to create event");
  
      const created = await res.json();
      setEvents((prev) => [...prev, created]);
      setNewEvent({
        name: "",
        airport: "",
        startTime: "",
        endTime: "",
        signupDeadline: "",
        googleSheetId: "",
        createdBy: "Admin",
      });
    } catch (err) {
      console.error(err);
    }
  }
  

  const deleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    refreshEvents();
  };

  useEffect(() => {
    refreshEvents();
  }, []);

  function formatZuluRange(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);
  
    // Hilfsfunktion zum Formatieren von Zahlen mit führender Null
    const pad = (num: number): string => num.toString().padStart(2, '0');
  
    // Monatskürzel
    const monthAbbr = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  
    const day = pad(start.getUTCDate());
    const month = monthAbbr[start.getUTCMonth()];
    const year = pad(start.getUTCFullYear() % 100); // Nur die letzten zwei Ziffern
  
    const startHours = pad(start.getUTCHours());
    const startMinutes = pad(start.getUTCMinutes());
    const endHours = pad(end.getUTCHours());
    const endMinutes = pad(end.getUTCMinutes());
  
    return `${day} ${month} ${year} | ${startHours}${startMinutes}z - ${endHours}${endMinutes}z`;
  }
  

  return (
    <div className="container mx-auto py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Event Management</h1>
        <Button onClick={() => setOpenDialog(true)}>+ New Event</Button>
      </div>

      {loading ? (
        <p>⏳ Lade Events...</p>
      ) : events.length === 0 ? (
        <p>Keine Events gefunden</p>
      ) : (

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id} className="rounded-xl shadow-sm hover:shadow-lg transition">
            <CardHeader>
              <CardTitle>{event.name}</CardTitle>
              <CardDescription>
                {formatZuluRange(event.startTime, event.endTime)}
                
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mt-2 text-sm text-gray-500">
                {event.registrations} Registrations
              </p>
              <p className=" text-sm text-gray-500">
              Deadline: {new Date(event.signupDeadline).toLocaleString()} </p>
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
            <Button
                variant="outline"
                onClick={async () => {
                    await fetch(`/api/events/${event.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "controlleranmeldung" }),
                    });
                    refreshEvents();
                }}
                >
                Controlleranmeldung öffnen
                </Button>

              <Button size="sm" variant="outline">
                <Eye className="w-4 h-4 mr-1" /> View Signups
              </Button>
              <Button size="sm" variant="outline">
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteEvent(event.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      )}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="pb-2">Name</Label>
              <Input
                value={newEvent.name}
                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
              />
            </div>
            <div>
                <Label className="pb-2">Airport</Label>
                <Input
                    value={newEvent.airport}
                    onChange={(e) => setNewEvent({ ...newEvent, airport: e.target.value })}
                />
           </div>
            <div>
                <Label className="pb-2">Start Time</Label>
                <Input
                    type="datetime-local"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                />
            </div>
            <div>
                <Label className="pb-2">End Time</Label>
                <Input
                    type="datetime-local"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                />
            </div>
            <div>
              <Label className="pb-2">Signup Deadline</Label>
              <Input
                type="datetime-local"
                value={newEvent.signupDeadline}
                onChange={(e) => setNewEvent({ ...newEvent, signupDeadline: e.target.value })}
              />
            </div>
            <div>
              <Label className="pb-2">Google Sheet ID</Label>
              <Input
                value={newEvent.googleSheetId}
                onChange={(e) => setNewEvent({ ...newEvent, googleSheetId: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createEvent}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
