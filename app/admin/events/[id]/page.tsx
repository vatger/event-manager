"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Settings,
  Play,
  Lock,
  Eye,
  Edit3,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Image,
  LinkIcon,
  ClipboardList,
  UserCog,
  EyeOff,
  X,
  UserPlus,
  Loader2,
  ChevronRight,
  BarChart3,
  MessageSquare,
  UserCheck,
  Flag,
  Trash2,
  Search,
} from "lucide-react";
import { Event, Signup } from "@/types";
import { toast } from "sonner";
import { BannerUrlDialog } from "./_components/BannerUrlDialog";
import { RosterLinkDialog } from "./_components/RosterLinkDialog";
import { SignupDeadlineDialog } from "./_components/SignupDeadlineDialog";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";
import type { EventTask } from "@/types/task";

interface TeamMember {
  cid: number;
  name: string;
  rating: string;
  role: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string }> = {
  DRAFT: { label: "Entwurf", variant: "outline", color: "bg-gray-100 text-gray-700 border-gray-300" },
  PLANNING: { label: "Planung", variant: "secondary", color: "bg-blue-100 text-blue-700 border-blue-200" },
  SIGNUP_OPEN: { label: "Anmeldung offen", variant: "default", color: "bg-green-100 text-green-700 border-green-200" },
  SIGNUP_CLOSED: { label: "Anmeldung geschlossen", variant: "secondary", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  ROSTER_PUBLISHED: { label: "Roster veröffentlicht", variant: "default", color: "bg-purple-100 text-purple-700 border-purple-200" },
  COMPLETED: { label: "Abgeschlossen", variant: "secondary", color: "bg-gray-100 text-gray-700 border-gray-300" },
  CANCELLED: { label: "Abgesagt", variant: "destructive", color: "bg-red-100 text-red-700 border-red-200" },
};

export default function EventOverviewPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [tasks, setTasks] = useState<EventTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [responsibleSearch, setResponsibleSearch] = useState("");
  const [responsibleDialogOpen, setResponsibleDialogOpen] = useState(false);

  const { canInOwnFIR } = useUser();
  const canEdit = canInOwnFIR("event.edit");
  const [canBanner, setCanBanner] = useState(false);

  const loadEventData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, signupsRes, tasksRes, teamRes, permRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/signup`),
        fetch(`/api/events/${eventId}/tasks`),
        fetch(`/api/events/${eventId}/team`),
        fetch(`/api/events/${eventId}/permissions`),
      ]);

      if (!eventRes.ok || !signupsRes.ok) throw new Error("Fehler beim Laden");

      const [eventData, signupsData] = await Promise.all([
        eventRes.json(),
        signupsRes.json(),
      ]);
      setEvent(eventData);
      setSignups(signupsData);

      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (teamRes.ok) setTeamMembers(await teamRes.json());
      if (permRes.ok) {
        const perms = await permRes.json();
        setCanBanner(perms.canBanner);
      }
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Laden der Event-Daten");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  const updateEventStatus = async (newStatus: string) => {
    if (!event) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      const updatedEvent = await res.json();
      setEvent(updatedEvent);
      toast.success(`Event Status geändert zu ${statusConfig[newStatus]?.label || newStatus}`);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Aktualisieren des Status");
    } finally {
      setUpdating(false);
    }
  };

  const handleEventUpdate = (updatedEvent: Event) => {
    setEvent(updatedEvent);
  };

  const handleAddResponsible = async (cid: number) => {
    if (!event) return;
    try {
      const res = await fetch(`/api/events/${event.id}/responsible`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid }),
      });
      if (!res.ok) throw new Error("Fehler");
      const newResponsible = await res.json();
      setEvent({ ...event, responsibles: [...(event.responsibles ?? []), newResponsible] });
      toast.success("Verantwortlicher hinzugefügt");
      setResponsibleDialogOpen(false);
      setResponsibleSearch("");
    } catch {
      toast.error("Fehler beim Hinzufügen");
    }
  };

  const handleRemoveResponsible = async (cid: number) => {
    if (!event) return;
    try {
      const res = await fetch(`/api/events/${event.id}/responsible/${cid}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler");
      setEvent({ ...event, responsibles: (event.responsibles ?? []).filter((r) => r.cid !== cid) });
      toast.success("Verantwortlicher entfernt");
    } catch {
      toast.error("Fehler beim Entfernen");
    }
  };

  const handleBannerVisibleToggle = async (visible: boolean) => {
    if (!event) return;
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerVisible: visible }),
      });
      if (!res.ok) throw new Error("Fehler");
      const updatedEvent = await res.json();
      setEvent(updatedEvent);
      toast.success(visible ? "Banner öffentlich sichtbar" : "Banner ausgeblendet");
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const getStatusActions = () => {
    if (!event) return [];
    const actions: Record<string, { label: string; action: string; icon: typeof Play; variant: "default" | "outline" }> = {
      DRAFT: { label: "In Planung setzen", action: "PLANNING", icon: Play, variant: "default" },
      PLANNING: { label: "Anmeldung öffnen", action: "SIGNUP_OPEN", icon: Users, variant: "default" },
      SIGNUP_OPEN: { label: "Anmeldung schließen", action: "SIGNUP_CLOSED", icon: Lock, variant: "outline" },
      SIGNUP_CLOSED: { label: "Roster veröffentlichen", action: "ROSTER_PUBLISHED", icon: Eye, variant: "default" },
    };
    return actions[event.status] ? [actions[event.status]] : [];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  };

  const availableTeamMembers = teamMembers.filter(
    (m) => !(event?.responsibles ?? []).some((r) => r.cid === m.cid)
  );

  const filteredTeamMembers = availableTeamMembers.filter(
    (m) => m.name.toLowerCase().includes(responsibleSearch.toLowerCase()) || String(m.cid).includes(responsibleSearch)
  );

  const taskStats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length,
    overdue: tasks.filter((t) => {
      if (!t.dueDate || t.status === "DONE" || t.status === "SKIPPED") return false;
      return new Date(t.dueDate) < new Date();
    }).length,
  };

  const stats = {
    totalSignups: signups.length,
    withAvailability: signups.filter((s) => s.availability && s.availability.available && s.availability.available.length > 0).length,
    staffedStationsCount: event?.staffedStations?.length || 0,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Lade Event-Daten...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Event konnte nicht geladen werden</AlertDescription>
        </Alert>
      </div>
    );
  }

  const status = statusConfig[event.status] || { label: event.status, variant: "secondary", color: "" };

  return (
    <div className="space-y-6">
      {/* Banner Section */}
      <div className="relative rounded-xl overflow-hidden bg-muted/20 border">
        {event.bannerUrl ? (
          <>
            <img 
              src={event.bannerUrl} 
              alt={`Banner für ${event.name}`} 
              className="w-full h-48 md:h-64 object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="text-2xl md:text-3xl font-bold">{event.name}</h1>
              {event.description && (
                <p className="text-white/80 mt-1 text-sm max-w-2xl line-clamp-2">{event.description}</p>
              )}
            </div>
            {(canEdit || canBanner) && (
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  {event.bannerVisible ? (
                    <Eye className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-white/60" />
                  )}
                  <Label htmlFor="banner-visible" className="text-xs text-white cursor-pointer">
                    {event.bannerVisible ? "Öffentlich" : "Verborgen"}
                  </Label>
                  <Switch
                    id="banner-visible"
                    checked={event.bannerVisible}
                    onCheckedChange={handleBannerVisibleToggle}
                    className="scale-75"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Image className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Kein Banner vorhanden</h3>
            <p className="text-muted-foreground text-sm mb-4">Füge einen Banner hinzu, um dein Event ansprechender zu gestalten.</p>
            <BannerUrlDialog event={event} onUpdate={handleEventUpdate} />
          </div>
        )}
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <CardTitle className="text-lg">Event Informationen</CardTitle>
                </div>
                {!event.bannerUrl && (
                    <p className="text-sm text-muted-foreground pl-3.5">{event.name}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Datum</span>
                </div>
                <p className="font-medium text-sm">{formatDate(event.startTime)}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Zeit (UTC)</span>
                </div>
                <p className="font-medium text-sm">{formatTime(event.startTime)} – {formatTime(event.endTime)}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Airport(s)</span>
                </div>
                <p className="font-medium text-sm">
                  {Array.isArray(event.airports) ? event.airports.join(", ") : event.airports}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Status</span>
                </div>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
            </div>

            {/* Status Alerts */}
            {event.status === "SIGNUP_OPEN" && event.signupDeadline && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-sm">
                  Anmeldung offen bis: <strong>{formatDate(event.signupDeadline)} – {new Date(event.signupDeadline).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} lcl</strong>
                </AlertDescription>
              </Alert>
            )}
            {event.status === "ROSTER_PUBLISHED" && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="flex items-center gap-2 text-sm">
                  Roster veröffentlicht
                  {event.rosterlink && (
                    <a href={event.rosterlink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <LinkIcon className="h-3 w-3" />
                      <span>Link öffnen</span>
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Staffed Stations */}
            {event.staffedStations && event.staffedStations.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Users className="h-3.5 w-3.5" />
                  <span>Zu besetzende Stationen</span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {event.staffedStations.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {event.staffedStations.map((station) => (
                    <Badge key={station} variant="secondary" className="text-xs">
                      {station}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions & Team Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <CardTitle className="text-lg">Aktionen & Team</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status Actions */}
            <div className="space-y-2">
              {event.status === "PLANNING" ? (
                <SignupDeadlineDialog event={event} onUpdate={handleEventUpdate} />
              ) : event.status === "SIGNUP_CLOSED" || event.status === "ROSTER_PUBLISHED" ? (
                <RosterLinkDialog event={event} onUpdate={handleEventUpdate} />
              ) : (
                getStatusActions().map((action, index) => {
                  const ActionIcon = action.icon;
                  return (
                    <Button
                      key={index}
                      onClick={() => updateEventStatus(action.action)}
                      disabled={updating}
                      variant={action.variant}
                      className="w-full justify-start"
                    >
                      <ActionIcon className="h-4 w-4 mr-2" />
                      {updating ? "Wird aktualisiert..." : action.label}
                    </Button>
                  );
                })
              )}
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/admin/events/${event.id}/edit`}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Event bearbeiten
                </Link>
              </Button>
            </div>

            {/* Responsible Section - Verbesserte Auswahl */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserCog className="h-3.5 w-3.5" />
                <span>Verantwortliche</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(event.responsibles ?? []).length === 0 && (
                  <span className="text-sm text-muted-foreground">Keine Verantwortlichen zugewiesen</span>
                )}
                {(event.responsibles ?? []).map((r) => (
                  <div
                    key={r.cid}
                    className="inline-flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-full pl-2.5 pr-1 py-0.5 text-sm"
                  >
                    <span className="text-xs font-medium">{r.name}</span>
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveResponsible(r.cid)}
                        className="rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                        aria-label={`${r.name} entfernen`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEdit && (
                <Dialog open={responsibleDialogOpen} onOpenChange={setResponsibleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      <UserPlus className="h-3.5 w-3.5 mr-2" />
                      Verantwortlichen hinzufügen
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg">Verantwortlichen hinzufügen</DialogTitle>
                      <DialogDescription>
                        Wähle ein Teammitglied aus, das für dieses Event verantwortlich sein soll.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="relative">
                        <Input
                          placeholder="Name oder CID suchen..."
                          value={responsibleSearch}
                          onChange={(e) => setResponsibleSearch(e.target.value)}
                          className="pl-8"
                        />
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
                        {filteredTeamMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {availableTeamMembers.length === 0 
                              ? "Keine weiteren Teammitglieder verfügbar" 
                              : "Keine passenden Mitglieder gefunden"}
                          </p>
                        ) : (
                          filteredTeamMembers.map((member) => (
                            <button
                              key={member.cid}
                              onClick={() => handleAddResponsible(member.cid)}
                              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                            >
                              <div>
                                <p className="font-medium text-sm">{member.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  CID: {member.cid} • {member.rating}
                                </p>
                              </div>
                              <UserPlus className="h-4 w-4 text-muted-foreground" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setResponsibleDialogOpen(false)}>
                        Abbrechen
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      
      <div className=" lg:grid-cols-2 gap-6">
        {/* Task Overview Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Aufgaben</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href={`/admin/events/${event.id}/tasks`}>
                  Alle anzeigen
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {taskStats.total === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Noch keine Aufgaben erstellt.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(taskStats.done / taskStats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {taskStats.done}/{taskStats.total}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {tasks
                    .filter((t) => t.status !== "DONE" && t.status !== "SKIPPED")
                    .slice(0, 3)
                    .map((task) => {
                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                      return (
                        <div key={task.id} className="flex items-center gap-2 text-sm py-1">
                          <div className={`h-1.5 w-1.5 rounded-full ${isOverdue ? "bg-destructive" : "bg-muted-foreground/40"}`} />
                          <span className="truncate flex-1 text-sm">{task.title}</span>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                              Überfällig
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  {tasks.filter((t) => t.status !== "DONE" && t.status !== "SKIPPED").length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      + {tasks.filter((t) => t.status !== "DONE" && t.status !== "SKIPPED").length - 3} weitere
                    </p>
                  )}
                </div>

                {taskStats.overdue > 0 && (
                  <p className="text-xs text-destructive font-medium">
                    {taskStats.overdue} {taskStats.overdue === 1 ? "Aufgabe ist" : "Aufgaben sind"} überfällig
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button asChild variant="outline" className="h-auto py-3 justify-start">
          <Link href={`/admin/events/${event.id}/signups`}>
            <Users className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium text-sm">Anmeldungen</div>
              <div className="text-xs text-muted-foreground">{stats.totalSignups} Controller</div>
            </div>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-3 justify-start">
          <Link href={`/admin/events/${event.id}/notify`}>
            <MessageSquare className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium text-sm">Benachrichtigen</div>
              <div className="text-xs text-muted-foreground">Nachricht senden</div>
            </div>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-3 justify-start">
          <Link href={`/admin/events/${event.id}/candidates`}>
            <UserCheck className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium text-sm">Lotsen finden</div>
              <div className="text-xs text-muted-foreground">Qualifizierte Controller</div>
            </div>
          </Link>
        </Button>
        <Button asChild variant="default" className="h-auto py-3 justify-start bg-primary hover:bg-primary/90">
          <a href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4 mr-2" />
            <div className="text-left">
              <div className="font-medium text-sm">Öffentliche Seite</div>
              <div className="text-xs text-primary-foreground/80">Für Teilnehmer</div>
            </div>
          </a>
        </Button>
      </div>
    </div>
  );
}