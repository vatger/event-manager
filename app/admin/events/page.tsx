"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EventCard } from "../events/_components/EventCard";
import Protected from "@/components/Protected";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CalendarPlus, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Event } from "@/types";
import { useUser } from "@/hooks/useUser";

type StatusFilter = "ALL" | "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "DRAFT" | "CANCELLED";

export default function AdminEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Modal state for opening signup
  const [openDialog, setOpenDialog] = useState(false);
  const [openTarget, setOpenTarget] = useState<Event | null>(null);
  const [openRosterDialog, setOpenRosterDialog] = useState(false);
  const [rosterInput, setRosterInput] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");  
  const [selectedFir, setSelectedFir] = useState<string | "ALL">("ALL");
  const { user, isVATGERLead, can, canInFIR, canInOwnFIR } = useUser();

  const [showPastEvents, setShowPastEvents] = useState(false);
  
  // Events aus API laden
  const refreshEvents = async (firCode?: string) => {
    setLoading(true);
    try {
      // FIR-Filter als Query
      const queryParam = firCode && firCode !== "ALL" ? `?fir=${firCode}` : "";
      const res = await fetch(`/api/events${queryParam}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data: Event[] = await res.json();

      const now = new Date();

      const upcoming = data.filter((event) => new Date(event.endTime) >= now);
      const past = data.filter((event) => new Date(event.endTime) < now);

      const sorted = [
        ...upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
        ...past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
      ];

      setEvents(sorted);
    } catch (err) {
      console.error("Failed to fetch events", err);
      setError("Fehler beim Laden der Events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wenn User vorhanden → Standard-FIR auswählen
    if (user) {
      if (isVATGERLead()) {
        setSelectedFir("ALL");
        refreshEvents("ALL");
      } else if (user.fir?.code) {
        setSelectedFir(user.fir.code);
        refreshEvents(user.fir.code);
      } else {
        refreshEvents("ALL");
      }
    }
  }, [user]);


  const handleDelete = async (id: string) => {
    if (!confirm("Event wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      setError("");
      refreshEvents();
    } catch (err) {
      setError("Fehler beim Löschen des Events");
    }
  };

  const openSignup = (event: Event) => {
    setError("");
    setOpenTarget(event);
    const prefill = event.signupDeadline ? new Date(event.signupDeadline).toISOString().slice(0, 16) : "";
    setDeadlineInput(prefill);
    setOpenDialog(true);
  };

  const publishRoster = (event: Event) => {
    setError("");
    setOpenTarget(event);
    const prefill = event.rosterlink || "";
    setRosterInput(prefill);
    setOpenRosterDialog(true);
  }

  const confirmPublishRoster = async () => {
    if (!openTarget) return;
    
    setBusy(true);
    setError("");
    
    try {
      const res = await fetch(`/api/events/${openTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ROSTER_PUBLISHED", rosterlink: rosterInput  }),
      });
      
      if (!res.ok) throw new Error("Fehler beim Veröffentlichen des Rosters");
      
      setOpenRosterDialog(false);
      setOpenTarget(null);
      refreshEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  const confirmOpenSignup = async () => {
    if (!openTarget) return;
    if (!deadlineInput) {
      setError("Bitte eine Signup-Deadline auswählen.");
      return;
    }
    
    setBusy(true);
    setError("");
    
    try {
      const res = await fetch(`/api/events/${openTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "SIGNUP_OPEN", 
          signupDeadline: new Date(deadlineInput).toISOString() 
        }),
      });
      
      if (!res.ok) throw new Error("Fehler beim Öffnen der Anmeldung");
      
      setOpenDialog(false);
      setOpenTarget(null);
      setDeadlineInput("");
      refreshEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  };

  const closeSignup = async (id: string) => {
    setBusy(true);
    setError("");
    
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SIGNUP_CLOSED" }),
      });
      
      if (!res.ok) throw new Error("Fehler beim Schließen der Anmeldung");
      refreshEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      
    } finally {
      setBusy(false);
    }
  };

  // Filter & Suche anwenden
  const filteredEvents = events.filter((event) => {
    const matchesQuery = `${event.name} ${event.airports}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || event.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const upcomingEvents = filteredEvents.filter((event) => new Date(event.endTime) >= new Date());
  const pastEvents = filteredEvents.filter((event) => new Date(event.endTime) < new Date());


  const stats = {
    total: filteredEvents.length,
    open: filteredEvents.filter((e) => e.status === "SIGNUP_OPEN").length,
    registrations: filteredEvents.reduce((acc, e) => acc + (e.registrations || 0), 0),
  };

  const router = useRouter();

  return (
    <Protected>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-3xl font-bold">Event Management</h1>
          <Button onClick={() => router.push("/admin/events/create")} disabled={!canInOwnFIR("event.create")}>
            <CalendarPlus />
              Neues Event
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Input
            placeholder="Suchen (Name oder ICAO)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="md:max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Status</SelectItem>
              <SelectItem value="DRAFT">Entwurf</SelectItem>
              <SelectItem value="PLANNING">Planning</SelectItem>
              <SelectItem value="SIGNUP_OPEN">Signup offen</SelectItem>
              <SelectItem value="SIGNUP_CLOSED">Signup closed</SelectItem>
              <SelectItem value="ROSTER_PUBLISHED">Plan hochgeladen</SelectItem>
              <SelectItem value="CANCELLED">Abgesagt</SelectItem>
            </SelectContent>
          </Select>
          
          {/* FIR Switcher */}
          {isVATGERLead() && (
            <Select
              value={selectedFir}
              onValueChange={(value) => {
                setSelectedFir(value);
                refreshEvents(value);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="FIR auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle FIRs</SelectItem>
                <SelectItem value="EDMM">EDMM - München</SelectItem>
                <SelectItem value="EDGG">EDGG - Langen</SelectItem>
                <SelectItem value="EDWW">EDWW - Bremen</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Events</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Signup offen</div>
              <div className="text-2xl font-bold">{stats.open}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm text-muted-foreground">Registrierungen</div>
              <div className="text-2xl font-bold">{stats.registrations}</div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">Lade Events...</p>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <p className="text-muted-foreground">Keine Events gefunden</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(400px,1fr))]">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                onEdit={() => router.push(`/admin/events/${event.id}/edit`)}
                event={event}
                onDelete={() => handleDelete(event.id)}
                onOpenSignup={() => openSignup(event)}
                onCloseSignup={() => closeSignup(event.id)}
                onpublishRoster={() => publishRoster(event)}
              />
            ))}
          </div>
        )}

        {/* Section for past events */}
        {pastEvents.length != 0 && (
          
          <div className="mt-6">
            <hr className="my-6" />
            <button
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
              onClick={() => setShowPastEvents((prev) => !prev)}
            >
              {showPastEvents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showPastEvents ? "Vergangene Events ausblenden" : "Vergangene Events anzeigen"}
            </button>

            {showPastEvents && (
              <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(400px,1fr))] mt-4">
                {pastEvents.length === 0 ? (
                  <p className="text-muted-foreground">Keine vergangenen Events gefunden</p>
                ) : (
                  pastEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      onEdit={() => router.push(`/admin/events/${event.id}/edit`)}
                      event={event}
                      onDelete={() => handleDelete(event.id)}
                      onOpenSignup={() => openSignup(event)}
                      onCloseSignup={() => closeSignup(event.id)}
                      onpublishRoster={() => publishRoster(event)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
        

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Controlleranmeldung öffnen</DialogTitle>
              <DialogDescription>
                Bitte geben Sie die Signup-Deadline an. Nach Ablauf ist die Anmeldung automatisch geschlossen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="deadline">Signup-Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                />
                </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={busy}>
                Abbrechen
              </Button>
              <Button onClick={confirmOpenSignup} disabled={busy || !deadlineInput}>
                {busy ? "Wird geöffnet..." : "Öffnen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openRosterDialog} onOpenChange={setOpenRosterDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Besetzungsplan veröffentlichen</DialogTitle>
              <DialogDescription>
                Bitte geben Sie den Link zum Besetzungsplan an.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="roster">Rosterlink</Label>
                <Input
                  id="roster"
                  type="url"
                  value={rosterInput}
                  onChange={(e) => {setRosterInput(e.target.value)}}
                />
                </div>
                <p className="text-xs text-muted-foreground">
                  Zu diesem Event angemeldete Controller werden benachrichtigt.
                </p>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenRosterDialog(false)} disabled={busy}>
                Abbrechen
              </Button>
              <Button onClick={confirmPublishRoster} disabled={busy || !rosterInput}>
                {busy ? "Wird veröffentlicht..." : "Veröffentlichen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Protected>
  );
}