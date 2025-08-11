"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: any; // später mit Typ
  onSuccess: () => void;
}

export function EventFormDialog({ open, onOpenChange, event, onSuccess }: Props) {
  const [form, setForm] = useState({
    name: "",
    airport: "",
    date: "",
    startZulu: "",
    endZulu: "",
    signupDeadline: "",
    createdBy: "Admin",
  });

  useEffect(() => {
    if (event) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      setForm({
        name: event.name,
        airport: event.airport,
        date: start.toISOString().slice(0, 10),
        startZulu: start.toISOString().slice(11, 16), // HH:MM UTC
        endZulu: end.toISOString().slice(11, 16),
        signupDeadline: event.signupDeadline
          ? new Date(event.signupDeadline).toISOString().slice(0, 16)
          : "",
        createdBy: event.createdBy || "Admin",
      });
    } else {
      setForm({
        name: "",
        airport: "",
        date: "",
        startZulu: "",
        endZulu: "",
        signupDeadline: "",
        createdBy: "Admin",
      });
    }
  }, [event]);

  const handleSubmit = async () => {
    // Kombiniere Datum + Uhrzeit → ISO (UTC)
    const startTime = new Date(`${form.date}T${form.startZulu}:00Z`).toISOString();
    const endTime = new Date(`${form.date}T${form.endZulu}:00Z`).toISOString();

    const method = event ? "PATCH" : "POST";
    const url = event ? `/api/events/${event.id}` : "/api/events";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        airport: form.airport,
        startTime,
        endTime,
        signupDeadline: form.signupDeadline
          ? new Date(form.signupDeadline).toISOString()
          : null,
        createdBy: form.createdBy,
        status: event ? event.status : "upcoming",
      }),
    });

    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Create New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* Airport */}
          <div>
            <Label>Airport</Label>
            <Input
              value={form.airport}
              onChange={(e) => setForm({ ...form, airport: e.target.value })}
            />
          </div>

          {/* Datum */}
          <div>
            <Label>Datum</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          {/* Startzeit Zulu */}
          <div>
            <Label>Startzeit (Zulu)</Label>
            <Input
              type="time"
              value={form.startZulu}
              onChange={(e) => setForm({ ...form, startZulu: e.target.value })}
            />
          </div>

          {/* Endzeit Zulu */}
          <div>
            <Label>Endzeit (Zulu)</Label>
            <Input
              type="time"
              value={form.endZulu}
              onChange={(e) => setForm({ ...form, endZulu: e.target.value })}
            />
          </div>

          {/* Signup Deadline */}
          <div>
            <Label>Signup Deadline (Optional)</Label>
            <Input
              type="datetime-local"
              value={form.signupDeadline}
              onChange={(e) =>
                setForm({ ...form, signupDeadline: e.target.value })
              }
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{event ? "Save" : "Create"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
