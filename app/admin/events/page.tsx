"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventCard } from "../events/_components/EventCard";
import { WeeklyEventCard } from "../events/_components/WeeklyEventCard";
import Protected from "@/components/Protected";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CalendarPlus, 
  ChevronDown, 
  ChevronUp, 
  CalendarClock, 
  Calendar,
  Users,
  Clock,
  Search,
  Filter,
  PlusCircle,
  Repeat
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Event } from "@/types";
import { useUser } from "@/hooks/useUser";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type StatusFilter = "ALL" | "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "DRAFT" | "CANCELLED";

interface WeeklyEventConfig {
  id: number;
  firId: number | null;
  fir?: { code: string; name: string };
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
  enabled: boolean;
  occurrences?: Array<{
    id: number;
    date: string;
  }>;
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export default function AdminEventsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [weeklyConfigs, setWeeklyConfigs] = useState<WeeklyEventConfig[]>([]);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Modal state
  const [openDialog, setOpenDialog] = useState(false);
  const [openTarget, setOpenTarget] = useState<Event | null>(null);
  const [openRosterDialog, setOpenRosterDialog] = useState(false);
  const [rosterInput, setRosterInput] = useState("");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");  
  const [selectedFir, setSelectedFir] = useState<string | "ALL">("ALL");
  const { user, isVATGERLead, canInFIR, canInOwnFIR } = useUser();

  const [showPastEvents, setShowPastEvents] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  
  const router = useRouter();

  // Events aus API laden
  const refreshEvents = async (firCode?: string) => {
    setLoading(true);
    try {
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

  // Fetch weekly events
  const refreshWeeklyEvents = async () => {
    try {
      const res = await fetch("/api/admin/discord/weekly-events");
      if (res.ok) {
        const data = await res.json();
        setWeeklyConfigs(data);
      }
    } catch (err) {
      console.error("Failed to fetch weekly events", err);
    }
  };

  useEffect(() => {
    refreshWeeklyEvents();
    
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
  };

  const confirmPublishRoster = async () => {
    if (!openTarget) return;
    
    setBusy(true);
    setError("");
    
    try {
      const res = await fetch(`/api/events/${openTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ROSTER_PUBLISHED", rosterlink: rosterInput }),
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
  };

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

  // Weekly event handlers
  const handleDeleteWeekly = async (id: number) => {
    if (!confirm("Weekly Event wirklich löschen?")) return;
    
    try {
      const res = await fetch(`/api/admin/discord/weekly-events/${id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        refreshWeeklyEvents();
      } else {
        setError("Fehler beim Löschen des Weekly Events");
      }
    } catch (err) {
      setError("Fehler beim Löschen des Weekly Events");
    }
  };

  // Check permissions for weekly events
  const canEditWeekly = (config: WeeklyEventConfig): boolean => {
    if (isVATGERLead()) return true;
    if (!config.fir?.code) return false;
    return canInFIR(config.fir.code, "event.edit");
  };

  const canDeleteWeekly = (config: WeeklyEventConfig): boolean => {
    if (isVATGERLead()) return true;
    if (!config.fir?.code) return false;
    return canInFIR(config.fir.code, "event.delete");
  };

  // Filter weeklys based on selected FIR
  const filteredWeeklyConfigs = weeklyConfigs.filter((config) => {
    if (selectedFir === "ALL") return true;
    return config.fir?.code === selectedFir;
  });

  // Group weeklys by FIR for display
  const weeklysByFir = filteredWeeklyConfigs.reduce((acc, config) => {
    const firCode = config.fir?.code || "global";
    if (!acc[firCode]) {
      acc[firCode] = [];
    }
    acc[firCode].push(config);
    return acc;
  }, {} as Record<string, WeeklyEventConfig[]>);

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

  return (
    <Protected>
      <div className="min-h-screen">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Event Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Verwalte alle Events und Weekly-Konfigurationen
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => router.push("/admin/events/create")} 
                disabled={!canInOwnFIR("event.create")}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Neues Event
              </Button>
              {canInOwnFIR("event.create") && (
                <Button 
                  onClick={() => router.push("/admin/weeklys/create")} 
                  variant="outline"
                  className="border-gray-300 dark:border-gray-700"
                >
                  <Repeat className="mr-2 h-4 w-4" />
                  Weekly erstellen
                </Button>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-gray-200 dark:border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Events</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.total}</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-gray-200 dark:border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Signup offen</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.open}</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-gray-200 dark:border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Registrierungen</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.registrations}</div>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-gray-200 dark:border-gray-800 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Events suchen (Name oder ICAO)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
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
              </div>
            </CardContent>
          </Card>

          {/* Regular Events Section */}
          <Card className="border-gray-200 dark:border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-600"></div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Events</h2>
                <Badge variant="outline" className="ml-2">
                  {upcomingEvents.length} bevorstehend
                </Badge>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Keine bevorstehenden Events gefunden</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
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
                </ScrollArea>
              )}

              {/* Past Events Toggle */}
              {pastEvents.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => setShowPastEvents(!showPastEvents)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    {showPastEvents ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {showPastEvents ? "Vergangene Events ausblenden" : `Vergangene Events anzeigen (${pastEvents.length})`}
                  </button>

                  {showPastEvents && (
                    <div className="grid gap-6 grid-cols-1 xl:grid-cols-2 mt-4 opacity-70">
                      {pastEvents.map((event) => (
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Events Section */}
          {filteredWeeklyConfigs.length > 0 && (
            <Card className="border-gray-200 dark:border-gray-800 mt-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weekly Events</h2>
                  <Badge variant="outline" className="ml-2">
                    {filteredWeeklyConfigs.length} aktiv
                  </Badge>
                </div>
                
                {Object.keys(weeklysByFir).length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(weeklysByFir).map(([firCode, configs]) => {
                      const firInfo = configs[0]?.fir;
                      return (
                        <div key={firCode} className="space-y-3">
                          {firInfo && (
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {firInfo.name}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {firInfo.code}
                              </Badge>
                            </div>
                          )}
                          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                            {configs.map((config) => (
                              <WeeklyEventCard
                                key={config.id}
                                config={config}
                                onEdit={() => router.push(`/admin/weeklys/${config.id}/edit`)}
                                onDelete={() => handleDeleteWeekly(config.id)}
                                canEdit={canEditWeekly(config)}
                                canDelete={canDeleteWeekly(config)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Keine Weekly Events gefunden
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        

        {/* Dialogs */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Controlleranmeldung öffnen</DialogTitle>
              <DialogDescription>
                Bitte geben Sie die Signup-Deadline an. Nach Ablauf ist die Anmeldung automatisch geschlossen.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deadline">Signup-Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="w-full"
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Besetzungsplan veröffentlichen</DialogTitle>
              <DialogDescription>
                Bitte geben Sie den Link zum Besetzungsplan an.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roster">Rosterlink</Label>
                <Input
                  id="roster"
                  type="url"
                  value={rosterInput}
                  onChange={(e) => setRosterInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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