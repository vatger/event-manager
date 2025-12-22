"use client";

import { useEffect, useMemo, useState } from "react";
import EventsSection from "@/components/EventsSection";
import { useSession } from "next-auth/react";
import { Event } from "@/types";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronUp, Filter, FolderArchive, Search, User } from "lucide-react";
import EventCard from "@/components/EventCard";
import { Input } from "@/components/ui/input";


export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFIR, setSelectedFIR] = useState(session?.user.fir || "all");
  const [showArchived, setShowArchived] = useState(false);
  
  useEffect(() => {
    async function loadEvents() {
      const url = session?.user?.id ? `/api/events?userCID=${session.user.id}` : "/api/events";
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data);
    }
    loadEvents();
  }, [session?.user?.id]);

  // Countdown für das nächste angemeldete Event
  useEffect(() => {
    if (signedUpEvents.length > 0) {
      // Finde das nächste Event an dem der User angemeldet ist
      const nextEvent = signedUpEvents
        .filter(event => new Date(event.startTime) > new Date())
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

      if (nextEvent) {
        const updateCountdown = () => {
          const now = new Date();
          const eventTime = new Date(nextEvent.startTime);
          const diff = eventTime.getTime() - now.getTime();

          if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
              setTimeUntilNextEvent(`${days} Tag${days !== 1 ? 'en' : ''}`);
            } else if (hours > 0) {
              setTimeUntilNextEvent(`${hours} Std ${minutes} Min`);
            } else {
              setTimeUntilNextEvent(`${minutes} Minuten`);
            }
          } else {
            setTimeUntilNextEvent('Event startet bald!');
          }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000); // Update every minute
        return () => clearInterval(interval);
      }
    }
  }, [events]);

  // Event-Kategorien
  const { signedUpEvents, openEvents, archivedEvents, firOverviewEvents } = useMemo(() => {
    const now = new Date().toISOString();
    const visible = events.filter((e: Event) => e.status !== "DRAFT");
    
    // Deine Events (angemeldet und zukünftig)
    const signedUpEvents = visible
      .filter((e: Event) => e.isSignedUp && e.endTime >= now);

    // Offene Events (SIGNUP_OPEN und zukünftig)
    const openEvents = visible.filter((e: Event) => 
      e.status === "SIGNUP_OPEN" && e.endTime > now && !e.isSignedUp
    );

    // Vergangene Events (Archiv)
    const archivedEvents = visible
      .filter((e: Event) => e.endTime <= now)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

    // Events für FIR-Übersicht - alle ZUKÜNFTIGEN Events
    const allFutureEvents = visible.filter((e: Event) => e.endTime > now);
    
    const firOverviewEvents = allFutureEvents.filter(event => {
      const matchesSearch = searchQuery === "" || 
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.airports[0].toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.firCode.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFIR = selectedFIR === "all" || event.firCode === selectedFIR;
      
      return matchesSearch && matchesFIR;
    });

    return { signedUpEvents, openEvents, archivedEvents, firOverviewEvents };
  }, [events, searchQuery, selectedFIR]);

  // FIR-Optionen für Filter
  const firOptions = [
    { value: "all", label: "Alle FIRs" },
    { value: "EDMM", label: "EDMM München" },
    { value: "EDGG", label: "EDGG Langen" },
    { value: "EDWW", label: "EDWW Bremen" },
  ];


  const [timeUntilNextEvent, setTimeUntilNextEvent] = useState('');

  


  return (
    <div className="container mx-auto py-8 space-y-12 p-3">
      {/* Subheader mit Countdown */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold tracking-tight">
          Willkommen{session?.user?.name && `, ${session.user.name.split(' ')[0]}`}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Melde dich hier für Events der einzelnen FIRs an.
        </p>
        
        {/* Quick Stats mit Countdown */}
        <div className="flex justify-center gap-6 pt-4 flex-wrap">
          {signedUpEvents.length > 0 && timeUntilNextEvent && (
            <div className="bg-gradient-to-br from-blue-900 to-blue-300 dark:via-blue-800/60 dark:to-black text-white px-6 py-3 rounded-lg shadow-lg">
              <div className="text-sm font-medium">Dein nächstes Event in</div>
              <div className="text-2xl font-bold">{timeUntilNextEvent}</div>
            </div>
          )}
        </div>
      </div>
  
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Deine Events */}
        {signedUpEvents.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">Deine Events</h2>
                <p className="text-muted-foreground text-sm">
                  {signedUpEvents.length} angemeldet{signedUpEvents.length !== 1 ? 'e' : 'es'} Event{signedUpEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 rounded-md">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{signedUpEvents.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {signedUpEvents.map(event => (
                <EventCard
                  key={`user-${event.id}`}
                  event={event}
                  showBanner
                />
              ))}
            </div>
          </section>
        )}

        {/* Offene Events */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Controlleranmeldungen</h2>
              <p className="text-muted-foreground text-sm">
                {openEvents.length} verfügbar{openEvents.length !== 1 ? 'e' : 'es'} Event{openEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            {openEvents.length > 0 && (
              <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 rounded-md">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-sm font-medium text-blue-700">{openEvents.length}</span>
              </div>
            )}
          </div>

          {openEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {openEvents.map(event => (
                <EventCard
                  key={`open-${event.id}`}
                  event={event}
                  showBanner
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted rounded-lg border border-dashed">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Keine offenen Events
              </h3>
              <p className="text-muted-foreground">
                Derzeit gibt es keine Events, für die du dich anmelden kannst.
              </p>
            </div>
          )}
        </section>

        {/* FIR Filter & Suche */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">Events nach FIR</h2>
            <p className="text-muted-foreground text-sm">Schaue die Events der einzelnen FIRs an</p>
          </div>

          {/* Suchleiste und FIR Filter */}
          <div className="bg-card rounded-lg border p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Events suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFIR("all");
                }}
                className="sm:w-32"
              >
                Zurücksetzen
              </Button>
            </div>
            
            {/* FIR Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {firOptions.map((fir) => (
                <Button
                  key={fir.value}
                  variant={selectedFIR === fir.value ? "default" : "outline"}
                  onClick={() => setSelectedFIR(fir.value)}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  {fir.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Gefilterte Events */}
          {firOverviewEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {firOverviewEvents.map(event => (
                <EventCard
                  key={`fir-${event.id}`}
                  event={event}
                  showBanner={false}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted rounded-lg border border-dashed">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Keine Events gefunden
              </h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedFIR !== "all" 
                  ? "Keine Events entsprechen deinen Suchfiltern." 
                  : "Keine zukünftigen Events verfügbar."
                }
              </p>
            </div>
          )}
        </section>

        {/* Archiv */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Archiv</h2>
              <p className="text-muted-foreground text-sm">
                {archivedEvents.length} vergangen{archivedEvents.length !== 1 ? 'e' : 'es'} Event{archivedEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
            >
              {showArchived ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ausblenden
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Anzeigen
                </>
              )}
            </Button>
          </div>

          {showArchived && (
            <>
              {archivedEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 opacity-60">
                  {archivedEvents.map(event => (
                    <EventCard
                      key={`archived-${event.id}`}
                      event={event}
                      showBanner={false}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-secondary rounded-lg border border-dashed border-gray-300">
                  <FolderArchive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-gray-400 mb-1">
                    Keine vergangenen Events
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Es sind noch keine Events im Archiv vorhanden.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {events.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <p>Keine Events verfügbar.</p>
          </div>
        )}
      </div>
    </div>
  );
}