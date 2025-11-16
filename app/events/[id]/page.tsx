"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence } from "framer-motion";
import SignupForm from "@/components/SignupForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useEventSignup } from "@/hooks/useEventSignup";
import SignupsTable, { SignupsTableRef } from "@/components/SignupsTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar, Clock, MapPin, RotateCcw, Tags, Users } from "lucide-react";
import Link from "next/link";
import EventBanner from "@/components/Eventbanner";
import { Event, Signup } from "@/types";
import StaffedStations from "@/components/StaffedStations";
import { useUser } from "@/hooks/useUser";

const formatTimeZ = (dateIso?: string | Date): string => {
  if (!dateIso) return "-";
  const d = new Date(dateIso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}z`;
};


export default function EventPage() {
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const userCID = session?.user.id;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const {canInFIR} = useUser();

  const tableRef = useRef<SignupsTableRef>(null);

  
  // Event laden
  useEffect(() => {
    if (!id) return;
    
    setEventLoading(true);
    setEventError("");

    fetch(`/api/events/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Fehler beim Laden des Events");
        }
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => {
        console.error("Event loading error:", err);
        setEventError(err.message || "Fehler beim Laden des Events");
      })
      .finally(() => setEventLoading(false));
  }, [id]);
  const handleSignupChanged = () => {
    tableRef.current?.reload();
  };

  const eventId = event?.id ?? id;
  const { loading: signupLoading, isSignedUp, signupData, refetch } = useEventSignup(eventId, Number(userCID));

  

  const dateLabel = useMemo(() => 
    event ? new Date(event.startTime).toLocaleDateString("de-DE") : "", 
    [event?.startTime]
  );

  const timeLabel = useMemo(() => 
    event ? `${formatTimeZ(event.startTime)} - ${formatTimeZ(event.endTime)}` : "",
      
    [event?.startTime, event?.endTime]
  );
  const timeLabellcl = useMemo(() => 
    event ? `${new Date(event.startTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}lcl
    - 
    ${new Date(event.endTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}lcl` : "",
      
    [event?.startTime, event?.endTime]
  );

  const airportsLabel = useMemo(() => 
    event ? (Array.isArray(event.airports) ? event.airports.join(", ") : String(event.airports ?? "-")) : "", 
    [event?.airports]
  );

  const normalizedEventForSignup = useMemo(() => 
    event ? {
      ...event,
      airports: Array.isArray(event.airports) ? event.airports[0] : event.airports,
    } : null,
    [event]
  );

  const getStatusBadgeVariant = (status: Event["status"]) => {
    switch (status) {
      case "SIGNUP_OPEN":
        return "default";
      case "PLANNING":
      case "DRAFT":
        return "secondary";
      case "ROSTER_PUBLISHED":
        return "outline";
      case "CANCELLED":
        return "destructive";
      case "SIGNUP_CLOSED":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (eventLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-3/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Skeleton className="md:col-span-2 h-64 md:h-auto rounded-xl" />
        </div>
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {eventError || "Event nicht gefunden"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Main Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Event Info Card */}
        <Card className="md:col-span-1 order-2 md:order-1 h-fit">
          <CardHeader className="relative">
            <CardTitle>Event Informationen</CardTitle>
            <div className="absolute right-4">
              <Badge variant={getStatusBadgeVariant(event.status)}>
                {event.status.replace("_", " ").toLowerCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Tags className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{event.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{dateLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{timeLabel}</span>
                  <span className="font-medium">({timeLabellcl})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{airportsLabel}</span>
              </div>
            </div>

            {event.description && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground w-full overflow-auto">{event.description}</p>
              </div>
            )}

            {event.status === "PLANNING" || event.status === "DRAFT" ? (
              <Button className="w-full" variant="secondary" disabled>
                Noch nicht geöffnet
              </Button>
            ) : event.status === "SIGNUP_OPEN" ? (
              signupLoading ? (
                <Button className="w-full" disabled>
                  Laden...
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedEvent(normalizedEventForSignup)}
                >
                  {isSignedUp ? "Anmeldung bearbeiten" : "Jetzt anmelden"}
                </Button>
              )
            ) : event.status === "SIGNUP_CLOSED" ? (
              signupLoading ? (
                <Button className="w-full" disabled>
                  Laden...
                </Button>
              ) : signupData?.deletedAt ? (
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedEvent(normalizedEventForSignup)}
                  variant="outline"
                >
                  Anmeldung wiederherstellen
                </Button>
              ) : isSignedUp ? (
                <Button 
                  className="w-full" 
                  onClick={() => setSelectedEvent(normalizedEventForSignup)}
                >
                  Anmeldung bearbeiten
                </Button>
              ) : (
                <Button className="w-full" variant="secondary" disabled>
                  Anmeldung geschlossen
                </Button>
              )
            ) : event.status === "ROSTER_PUBLISHED" ? (
              <Button className="w-full" disabled={!event.rosterlink}>
                <Link href={event.rosterlink || '#'} target="_blank"  className="w-full">
                  {event.rosterlink ? "Besetzungsplan anzeigen" : "Kein Besetzungsplan verfügbar"}
                </Link>
              </Button>
            ) : event.status === "CANCELLED" ? (
              <Button className="w-full" variant="destructive" disabled>
                Event abgesagt
              </Button>
            ) : null}
            {(event.status=="SIGNUP_OPEN" && event.signupDeadline) && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Anmeldeschluss: {new Date(event.signupDeadline).toLocaleDateString("de-DE")}</span>
                </div>
              )}
            {(event.status=="SIGNUP_CLOSED" && isSignedUp) && (
              <div className="flex items-center gap-2 text-sm">
                  <span className="text-sm text-muted-foreground w-full overflow-auto">Du kannst deine Anmeldung weiterhin bearbeiten. Das Eventteam wird über Änderungen informiert.</span>
              </div>
            )}
            {(event.status=="SIGNUP_CLOSED" && !isSignedUp && signupData?.deletedAt) && (
              <div className="flex items-center gap-2 text-sm">
                  <span className="text-sm text-orange-600 w-full overflow-auto">Deine Anmeldung wurde gelöscht. Du kannst sie wiederherstellen.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Banner */}
        <div className="md:col-span-2 order-1 md:order-2 min-h-0">
          {/* Mobile: fixe Höhe, Desktop: exakt so hoch wie die Card */}
          <div className="relative h-56 md:h-full rounded-2xl overflow-hidden">
            <EventBanner
              bannerUrl={event.bannerUrl} 
              eventName={event.name}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          </div>
        </div>
        </div>
      {(event.status === "SIGNUP_OPEN" || event.status === "SIGNUP_CLOSED" || event.status === "ROSTER_PUBLISHED") && (
        <StaffedStations callsigns={event.staffedStations} />
      )}

      {/* Teilnehmer Tabelle */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex justify-between">
            <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
              Angemeldete Teilnehmer
            </div>
            <Button onClick={handleSignupChanged} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" /> <p className="hidden sm:block ml-1">Neu laden</p>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignupsTable
            ref={tableRef}
            eventId={Number(event.id)}
            columns={["cid", "name", "group", "availability", "preferredStations", "remarks"]}
            editable={canInFIR(event.firCode, "signups.manage")}
            event={event}
            onRefresh={handleSignupChanged}
          />
        </CardContent>

        {event.status === "ROSTER_PUBLISHED" && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center flex-col gap-4 p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Besetzungsplan ist verfügbar!</h3>
              <p className="text-muted-foreground">Der finale Besetzungsplan wurde veröffentlicht.</p>
            </div>
            <Button size="lg" disabled={!event.rosterlink}>
            <Link href={event.rosterlink || '#'} target="_blank"  className="w-full">
                  {event.rosterlink ? "Zum Besetzungsplan" : "FEHLER"}
                </Link>
            </Button>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {selectedEvent && (
          <SignupForm
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onChanged={() => { 
              refetch();
              handleSignupChanged();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}