"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard } from "./_components/EventCard";
import Protected from "@/components/Protected";
import AdminEventForm from "./_components/AdminEventForm";

interface Event {
  id: string;
  name: string;
  description: string;
  bannerUrl: string;
  airports: string[];
  startTime: string;
  endTime: string;
  staffedStations: string[];
  signupDeadline: string | null;
  registrations: number;
  status: "PLANNING" | "SIGNUP_OPEN" | "PLAN_UPLOADED" | "COMPLETED" | string;
}

type StatusFilter = "ALL" | "PLANNING" | "SIGNUP_OPEN" | "PLAN_UPLOADED" | "COMPLETED";

export default function AdminEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Modal state for opening signup
  const [openDialog, setOpenDialog] = useState(false);
  const [openTarget, setOpenTarget] = useState<Event | null>(null);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  // Öffnen Dialog vorbereiten
  const openSignup = (event: Event) => {
    setError("");
    setOpenTarget(event);
    // vorfüllen: existierende Deadline, sonst leer
    const prefill = event.signupDeadline ? new Date(event.signupDeadline).toISOString().slice(0,16) : "";
    setDeadlineInput(prefill);
    setOpenDialog(true);
  };

  // Öffnen bestätigen
  const confirmOpenSignup = async () => {
    if (!openTarget) return;
    if (!deadlineInput) {
      setError("Bitte eine Signup-Deadline auswählen.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${openTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SIGNUP_OPEN", signupDeadline: new Date(deadlineInput).toISOString() }),
      });
      if (!res.ok) throw new Error("Fehler beim Öffnen der Anmeldung");
      setOpenDialog(false);
      setOpenTarget(null);
      setDeadlineInput("");
      refreshEvents();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Schließen der Anmeldung
  const closeSignup = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Fehler beim Schließen der Anmeldung");
      refreshEvents();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Filter & Suche anwenden
  const filtered = events.filter((e) => {
    const matchesQuery = `${e.name} ${(e.airports || []).join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "ALL" ? true : e.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const stats = {
    total: filtered.length,
    open: filtered.filter((e) => e.status === "SIGNUP_OPEN").length,
    registrations: filtered.reduce((acc, e) => acc + (e.registrations || 0), 0),
  };

  return (
    <Protected>
      <div className="container mx-auto py-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold">Event Management</h1>
          <Button onClick={handleCreate}>+ New Event</Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <Input
            placeholder="Suchen (Name oder ICAO)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="md:w-80"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Status</SelectItem>
              <SelectItem value="PLANNING">Planning</SelectItem>
              <SelectItem value="SIGNUP_OPEN">Signup offen</SelectItem>
              <SelectItem value="PLAN_UPLOADED">Plan hochgeladen</SelectItem>
              <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
            </SelectContent>
          </Select>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Events</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Signup offen</div>
              <div className="text-2xl font-semibold">{stats.open}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Registrations</div>
              <div className="text-2xl font-semibold">{stats.registrations}</div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <p>⏳ Lade Events...</p>
        ) : filtered.length === 0 ? (
          <p>Keine Events gefunden</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={() => handleEdit(event)}
                onDelete={() => handleDelete(event.id)}
                onOpenSignup={openSignup}
                onCloseSignup={closeSignup}
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

        {/* Dialog zum Setzen der Signup-Deadline */}
        {openDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-background rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Controlleranmeldung öffnen</h2>
                <p className="text-sm text-muted-foreground">
                  Bitte gib die Signup-Deadline an. Nach Ablauf ist die Anmeldung automatisch geschlossen.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Signup-Deadline</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border px-3 py-2"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setOpenDialog(false); setOpenTarget(null); }} disabled={busy}>
                  Abbrechen
                </Button>
                <Button onClick={confirmOpenSignup} disabled={busy || !deadlineInput}>
                  {busy ? "Öffnen…" : "Öffnen"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Protected>
  );
}
