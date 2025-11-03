// app/admin/events/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, MapPin, AlertCircle, Bell, UserCheck } from "lucide-react";
import { Event, Signup } from "@/types";
import { useParams } from "next/navigation";

interface EventStats {
  totalSignups: number;
  byEndorsement: Record<string, number>;
  availabilityRate: number;
}

export default function EventOverviewPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EventStats>({
    totalSignups: 0,
    byEndorsement: {},
    availabilityRate: 0
  });

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
      calculateStats(signupsData);
    } catch (error) {
      console.error("Fehler:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (signupsData: Signup[]) => {
    const byEndorsement: Record<string, number> = {};
    let totalAvailability = 0;

    signupsData.forEach(signup => {
      // Endorsement Stats
      const endorsement = "SOON";
      byEndorsement[endorsement] = (byEndorsement[endorsement] || 0) + 1;

      // Availability Rate (vereinfacht)
      if (signup.availability && signup.availability.available) {
        totalAvailability++;
      }
    });

    setStats({
      totalSignups: signupsData.length,
      byEndorsement,
      availabilityRate: signupsData.length > 0 ? (totalAvailability / signupsData.length) * 100 : 0
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Lade Event-Daten...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-destructive">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Event konnte nicht geladen werden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anmeldungen</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSignups}</div>
            <p className="text-xs text-muted-foreground">
              Controller angemeldet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verfügbarkeit</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.availabilityRate)}%</div>
            <p className="text-xs text-muted-foreground">
              Mit Verfügbarkeit
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positionen</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(stats.byEndorsement).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Verschiedene Endorsements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={event.status === "SIGNUP_OPEN" ? "default" : "secondary"}>
                {event.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Event Status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Endorsement Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Positionen Übersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byEndorsement).map(([endorsement, count]) => (
              <div key={endorsement} className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">{endorsement.toLowerCase()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellaktionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`/admin/events/${eventId}/signups`}>
                <Users className="h-4 w-4 mr-2" />
                Anmeldungen anzeigen
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/admin/events/${eventId}/notify`}>
                <Bell className="h-4 w-4 mr-2" />
                Benachrichtigung senden
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/admin/events/${eventId}/candidates`}>
                <UserCheck className="h-4 w-4 mr-2" />
                Potenzielle Lotsen finden
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}