"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Clock, MapPin, Users, Settings, Play, Lock, Eye, Edit3, RefreshCw, AlertCircle, CheckCircle2, Image, LinkIcon } from "lucide-react";
import { Event, Signup } from "@/types";
import { toast } from "sonner";
import { BannerUrlDialog } from "./_components/BannerUrlDialog";
import { RosterLinkDialog } from "./_components/RosterLinkDialog";
import { SignupDeadlineDialog } from "./_components/SignupDeadlineDialog";
import { useUser } from "@/hooks/useUser";
import Link from "next/link";
import router from "next/router";

export default function EventOverviewPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const { canInOwnFIR } = useUser();

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    setLoading(true);
    try {
      const [eventRes, signupsRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/signup`)
      ]);

      if (!eventRes.ok || !signupsRes.ok) throw new Error("Fehler beim Laden");

      const eventData = await eventRes.json();
      const signupsData = await signupsRes.json();

      setEvent(eventData);
      setSignups(signupsData);
    } catch (error) {
      console.error("Fehler:", error);
      toast.error("Fehler beim Laden der Event-Daten");
    } finally {
      setLoading(false);
    }
  };

  const updateEventStatus = async (newStatus: string) => {
    if (!event) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Fehler beim Aktualisieren");

      const updatedEvent = await res.json();
      setEvent(updatedEvent);
      
      toast.success(`Event Status geändert zu ${newStatus}`);
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

  const getStatusActions = () => {
    if (!event) return [];

    const actions = {
      DRAFT: {
        label: "In Planning setzen",
        description: "Event für interne Planung freigeben",
        action: "PLANNING",
        icon: Play,
        variant: "default" as const
      },
      PLANNING: {
        label: "Anmeldung öffnen",
        description: "Event für Controller-Anmeldungen öffnen",
        action: "SIGNUP_OPEN",
        icon: Users,
        variant: "default" as const
      },
      SIGNUP_OPEN: {
        label: "Anmeldung schließen",
        description: "Keine weiteren Anmeldungen mehr annehmen",
        action: "SIGNUP_CLOSED",
        icon: Lock,
        variant: "outline" as const
      },
      SIGNUP_CLOSED: {
        label: "Roster veröffentlichen",
        description: "Besetzungsplan für alle sichtbar machen",
        action: "ROSTER_PUBLISHED",
        icon: Eye,
        variant: "default" as const
      },
    };

    return actions[event.status as keyof typeof actions] ? [actions[event.status as keyof typeof actions]] : [];
  };

  const getStatusBadgeVariant = (status: string) => {
    const variants = {
      DRAFT: "outline",
      PLANNING: "secondary",
      SIGNUP_OPEN: "default",
      SIGNUP_CLOSED: "outline",
      ROSTER_PUBLISHED: "secondary",
      COMPLETED: "default"
    };
    return variants[status as keyof typeof variants] || "outline";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Statistiken berechnen
  const stats = {
    totalSignups: signups.length,
    withAvailability: signups.filter(s => s.availability && s.availability.available && s.availability.available.length > 0).length,
    staffedStationsCount: event?.staffedStations?.length || 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Lade Event-Daten...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Event konnte nicht geladen werden
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusActions = getStatusActions();

  return (
    <div className="space-y-6">
      {/* Event Banner */}
      {event.bannerUrl ? (
        <div className="relative h-48 md:h-64 rounded-lg overflow-hidden border">
          <img
            src={event.bannerUrl}
            alt={`Banner für ${event.name}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end">
            <div className="p-6 text-white">
              <h1 className="text-2xl md:text-3xl font-bold">{event.name}</h1>
              {event.description && (
                <p className="text-white/80 mt-1 max-w-2xl">{event.description}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Kein Banner vorhanden</h3>
            <p className="text-muted-foreground mb-4">
              Füge einen Banner hinzu, um dein Event ansprechender zu gestalten.
            </p>
            <BannerUrlDialog event={event} onUpdate={handleEventUpdate} />
          </CardContent>
        </Card>
      )}

      {/* Header mit Event Info */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1 space-y-4">
              {/* Event Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Datum</span>
                  </div>
                  <div className="font-medium">{formatDate(event.startTime)}</div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Zeit (UTC)</span>
                  </div>
                  <div className="font-medium">
                    {new Date(event.startTime).toLocaleTimeString('de-DE', { 
                      hour: '2-digit', minute: '2-digit', timeZone: 'UTC' 
                    })}z - {new Date(event.endTime).toLocaleTimeString('de-DE', { 
                      hour: '2-digit', minute: '2-digit', timeZone: 'UTC' 
                    })}z
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Airport</span>
                  </div>
                  <div className="font-medium">{event.airports}</div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings className="h-4 w-4" />
                    <span>Status</span>
                  </div>
                  <Badge 
                    variant={getStatusBadgeVariant(event.status) as any}
                    className="font-semibold"
                  >
                    {event.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Zusätzliche Info je nach Status */}
              {event.status === "SIGNUP_OPEN" && event.signupDeadline && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    Anmeldung offen bis: <strong>{formatDate(event.signupDeadline)}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {event.status === "ROSTER_PUBLISHED" && (
                <Alert className="bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        <div className="flex items-center gap-2 w-full">
                          <span className="whitespace-nowrap">Roster veröffentlicht</span>
                          {event.rosterlink && (
                            <a href={event.rosterlink} target="_blank" rel="noopener noreferrer">
                              <LinkIcon className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              )}
              </div>
              {/* Status Actions */}
              <div className="flex flex-col gap-3 flex-shrink-0">
                {event.status == "PLANNING" ? (
                  <SignupDeadlineDialog event={event} onUpdate={handleEventUpdate} />
                ) : event.status == "SIGNUP_CLOSED" || event.status == "ROSTER_PUBLISHED"  ? (
                  <RosterLinkDialog event={event} onUpdate={handleEventUpdate} />
                ) : (
                  statusActions.map((action, index) => {
                    const ActionIcon = action.icon;
                    return (
                      <Button
                        key={index}
                        onClick={() => updateEventStatus(action.action)}
                        disabled={updating}
                        variant={action.variant}
                        className="min-w-[200px] justify-start"
                      >
                        <ActionIcon className="h-4 w-4 mr-2" />
                        {updating ? "Wird aktualisiert..." : action.label}
                      </Button>
                    );
                  })
                )}
                <Button variant="outline" asChild>
                  <a href={`/admin/events/${event.id}/edit`}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Event bearbeiten
                  </a>
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>

      

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellaktionen</CardTitle>
          <CardDescription>
            Häufig genutzte Funktionen für dieses Event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="w-full justify-start h-auto py-3">
              <Link href={`/admin/events/${event.id}/signups`}>
                <Users className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Anmeldungen</div>
                  <div className="text-xs text-muted-foreground">{stats.totalSignups} Controller</div>
                </div>
              </Link>
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              disabled={!canInOwnFIR("user.notif")}
              onClick={() => router.push(`/admin/events/${event.id}/notify`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Benachrichtigen</div>
                <div className="text-xs text-muted-foreground">Nachricht senden</div>
              </div>
            </Button>
            
            <Button asChild variant="outline" className="w-full justify-start h-auto py-3">
              <Link href={`/admin/events/${event.id}/candidates`}>
                <Users className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Lotsen finden</div>
                  <div className="text-xs text-muted-foreground">Qualifizierte Controller</div>
                </div>
              </Link>
            </Button>

            {event.status === "SIGNUP_OPEN" && (
              <Button asChild variant="default" className="w-full justify-start h-auto py-3">
                <a href={`/events/${event.id}`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Öffentliche Seite</div>
                    <div className="text-xs">Für Teilnehmer</div>
                  </div>
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Staffed Stations */}
      {event.staffedStations && event.staffedStations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Zu besetzende Stationen</CardTitle>
            <CardDescription>
              Alle Stationen die für dieses Event verfügbar sind
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {event.staffedStations.map((station) => (
                <Badge key={station} variant="outline" className="text-sm px-3 py-1">
                  {station}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}