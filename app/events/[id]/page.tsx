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
import AirportSignupTabs, { AirportSignupTabsRef } from "@/components/AirportSignupTabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar, Clock, ExternalLink, MapPin, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import EventBanner from "@/components/Eventbanner";
import { Event, Signup } from "@/types";
import StaffedStations from "@/components/StaffedStations";
import PublicRoster from "./_components/PublicRoster";
import { useUser,  } from "@/hooks/useUser";
import RichText from "@/components/RichText";
import { cn } from "@/lib/utils";
import {
  eventAirportList,
  eventStatusDisplay,
  formatEventDate,
  formatEventWeekday,
  formatLocalDate,
  formatLocalTime,
  formatZulu,
} from "@/lib/events/eventDisplay";

export default function EventPage() {
  const { id } = useParams() as { id: string };
  const { data: session } = useSession();
  const userCID = session?.user.id;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  // Solange die öffentliche Roster-Ansicht deaktiviert ist, bleibt das false –
  // die Seite verhält sich dann wie vor dem Umbau und nutzt den rosterlink.
  const [hasInternalRoster, setHasInternalRoster] = useState(false);
  const {canInFIR, isEventFirTeamMember} = useUser();

  const tableRef = useRef<SignupsTableRef>(null);
  const tabsRef = useRef<AirportSignupTabsRef>(null);

  // Get airports as array
  const eventAirports = useMemo(() => eventAirportList(event?.airports), [event?.airports]);
  
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
    if (eventAirports.length > 1) {
      tabsRef.current?.reload();
    } else {
      tableRef.current?.reload();
    }
  };

  const eventId = event?.id ?? id;
  const { loading: signupLoading, isSignedUp, signupData, refetch } = useEventSignup(eventId, Number(userCID));

  const dateLabel = useMemo(
    () => (event ? `${formatEventWeekday(new Date(event.startTime))}, ${formatEventDate(new Date(event.startTime))}` : ""),
    [event?.startTime]
  );

  const timeLabel = useMemo(
    () => (event ? `${formatZulu(new Date(event.startTime))} – ${formatZulu(new Date(event.endTime))}` : ""),
    [event?.startTime, event?.endTime]
  );

  const timeLabellcl = useMemo(
    () =>
      event
        ? `${formatLocalTime(new Date(event.startTime))} – ${formatLocalTime(new Date(event.endTime))} lcl`
        : "",
    [event?.startTime, event?.endTime]
  );

  const normalizedEventForSignup = useMemo(() => 
    event ? {
      ...event,
      airports: Array.isArray(event.airports) ? event.airports : event.airports[0],
    } : null,
    [event]
  );

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

  const status = eventStatusDisplay(event.status);
  const airportsTitle = eventAirports.join(", ");

  // Handlung je Status – dieselben Bedingungen wie bisher, nur an einer Stelle.
  const actionButton =
    event.status === "PLANNING" || event.status === "DRAFT" ? (
      <Button className="w-full" variant="secondary" disabled>
        Noch nicht geöffnet
      </Button>
    ) : event.status === "SIGNUP_OPEN" ? (
      signupLoading ? (
        <Button className="w-full" disabled>
          Laden…
        </Button>
      ) : (
        <Button className="w-full" onClick={() => setSelectedEvent(normalizedEventForSignup)}>
          {isSignedUp ? "Anmeldung bearbeiten" : "Jetzt anmelden"}
        </Button>
      )
    ) : event.status === "SIGNUP_CLOSED" ? (
      signupLoading ? (
        <Button className="w-full" disabled>
          Laden…
        </Button>
      ) : signupData?.deletedAt && canInFIR(event.firCode, "signups.manage") ? (
        <Button className="w-full" variant="outline" onClick={() => setSelectedEvent(normalizedEventForSignup)}>
          Anmeldung wiederherstellen
        </Button>
      ) : isSignedUp ? (
        <Button className="w-full" onClick={() => setSelectedEvent(normalizedEventForSignup)}>
          Anmeldung bearbeiten
        </Button>
      ) : (
        <Button className="w-full" variant="secondary" disabled>
          Anmeldung geschlossen
        </Button>
      )
    ) : event.status === "ROSTER_PUBLISHED" ? (
      hasInternalRoster ? (
        <Button className="w-full" asChild>
          <a href="#besetzungsplan">Besetzungsplan anzeigen</a>
        </Button>
      ) : event.rosterlink ? (
        <Button className="w-full" asChild>
          <Link href={event.rosterlink} target="_blank">
            Besetzungsplan anzeigen
          </Link>
        </Button>
      ) : (
        <Button className="w-full" variant="secondary" disabled>
          Kein Besetzungsplan verfügbar
        </Button>
      )
    ) : event.status === "CANCELLED" ? (
      <Button className="w-full" variant="destructive" disabled>
        Event abgesagt
      </Button>
    ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Kopfbereich im Zuschnitt der Eventkarte, aus der man hierherkommt */}
      <div className="relative h-64 overflow-hidden rounded-2xl border bg-primary-900 md:h-80">
        <EventBanner
          bannerUrl={event.bannerUrl}
          eventName={event.name}
          className="absolute inset-0 h-full w-full object-cover object-center"
          showFallbackCaption={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/60 to-transparent" />

        <div className="absolute left-5 top-4 flex flex-wrap items-center gap-1.5 sm:left-7">
          <Badge className={cn("font-medium", status.className)}>{status.label}</Badge>
          <Badge className="bg-secondary-50/15 font-semibold text-secondary-50 backdrop-blur-sm">
            {event.firCode}
          </Badge>
        </div>

        {isEventFirTeamMember(event.firCode) && (
          <Link
            href={`/admin/events/${event.id}`}
            title="Zum Event im Adminbereich"
            className="absolute right-5 top-4 rounded-md bg-secondary-50/15 p-2 text-secondary-50 backdrop-blur-sm transition-colors hover:bg-secondary-50/25 sm:right-7"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-5 pb-5 pt-8 sm:px-7">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent-500">
            {dateLabel} · {timeLabel}
          </span>
          <h1 className="text-pretty text-2xl font-bold leading-tight text-secondary-50 sm:text-3xl">
            {event.name}
          </h1>
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-secondary-300">
            <MapPin className="h-4 w-4 shrink-0" />
            {/* Bei vielen Flughaefen nur die Anzahl – die Liste steht unten vollstaendig */}
            <span className="truncate" title={airportsTitle}>
              {eventAirports.length > 3
                ? `${eventAirports.length} Flughäfen`
                : airportsTitle || "Kein Flughafen hinterlegt"}
            </span>
          </span>
        </div>
      </div>

      {/* Fakten und Handlung */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <dl className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Termin</dt>
                <dd className="text-sm font-semibold text-foreground">{dateLabel}</dd>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-muted-foreground">Zeit</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{timeLabel}</dd>
                <dd className="text-xs tabular-nums text-muted-foreground">{timeLabellcl}</dd>
              </div>
            </div>

            {event.status === "SIGNUP_OPEN" && event.signupDeadline && (
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-600 dark:text-accent-500" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">Anmeldeschluss</dt>
                  <dd className="text-sm font-semibold text-accent-600 dark:text-accent-500">
                    {formatLocalDate(new Date(event.signupDeadline))} ·{" "}
                    {formatLocalTime(new Date(event.signupDeadline))} lcl
                  </dd>
                </div>
              </div>
            )}
          </dl>

          <div className="w-full shrink-0 lg:w-56">{actionButton}</div>
        </CardContent>
      </Card>

      {event.status === "SIGNUP_CLOSED" && isSignedUp && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du kannst deine Anmeldung weiterhin bearbeiten. Das Eventteam wird über Änderungen
            informiert.
          </AlertDescription>
        </Alert>
      )}

      {/* Flughaefen vollstaendig – als Plaketten bleibt auch eine lange Liste ruhig */}
      {eventAirports.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Flughäfen
              <Badge variant="secondary" className="ml-1 font-semibold">
                {eventAirports.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {eventAirports.map((icao) => (
                <span
                  key={icao}
                  className="inline-flex items-center rounded-md border bg-muted/50 px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wide text-foreground"
                >
                  {icao}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {event.description && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Beschreibung</CardTitle>
          </CardHeader>
          <CardContent>
            <RichText
              text={event.description}
              className="block w-full break-words text-sm text-muted-foreground"
            />
          </CardContent>
        </Card>
      )}
      {(event.status === "SIGNUP_OPEN" || event.status === "SIGNUP_CLOSED") && (
        <StaffedStations callsigns={event.staffedStations} />
      )}

      {/* Interner Besetzungsplan (sobald veröffentlicht). */}
      {event.status === "ROSTER_PUBLISHED" && (
        <PublicRoster
          eventId={Number(event.id)}
          userCID={session?.user.cid ? Number(session.user.cid) : null}
          onLoaded={setHasInternalRoster}
        />
      )}

      {!hasInternalRoster && (
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
            {eventAirports.length > 1 ? (
              <AirportSignupTabs
                ref={tabsRef}
                airports={eventAirports}
                eventId={Number(event.id)}
                renderSignupsTable={(filteredSignups, airport) => (
                  <SignupsTable
                    ref={tableRef}
                    eventId={Number(event.id)}
                    columns={["cid", "name", "group", "airports", "availability", "preferredStations", "remarks"]}
                    editable={canInFIR(event.firCode, "signups.manage")}
                    event={event}
                    onRefresh={handleSignupChanged}
                    filteredSignups={filteredSignups}
                    currentAirport={airport}
                  />
                )}
              />
            ) : (
              <SignupsTable
                ref={tableRef}
                eventId={Number(event.id)}
                columns={["cid", "name", "group", "availability", "preferredStations", "remarks"]}
                editable={canInFIR(event.firCode, "signups.manage")}
                event={event}
                onRefresh={handleSignupChanged}
              />
            )}
          </CardContent>

          {event.status === "ROSTER_PUBLISHED" && !hasInternalRoster && (
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
      )}
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