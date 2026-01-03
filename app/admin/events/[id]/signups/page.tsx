"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Event } from "@/types";
import EventHeader from "../_components/EventHeader";
import { StatsCard, StatsCardHandle } from "../_components/StatsCard";
import SyncToSheetsButton from "../_components/SyncToSheetsButton";
import { useUser } from "@/hooks/useUser";
import { AvailabilityTimeline, AvailabilityTimelineHandle } from "../_components/AvailabilityTimeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SignupsTable, { SignupsTableRef } from "@/components/SignupsTable";
import AirportSignupTabs from "@/components/AirportSignupTabs";
import { Users, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseEventAirports } from "@/lib/multiAirport";
import { SignupTableEntry } from "@/lib/cache/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminEventSignupsPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState<boolean>(true);
  const [eventError, setEventError] = useState<string>("");
  const [selectedAirport, setSelectedAirport] = useState<string | undefined>(undefined);

  const tableRef = useRef<SignupsTableRef>(null);
  const timelineRef = useRef<AvailabilityTimelineHandle>(null);
  const statsRef = useRef<StatsCardHandle>(null);
  const { canInFIR } = useUser();

  // Event laden
  useEffect(() => {
    if (!eventId) return;
    setEventLoading(true);
    setEventError("");

    fetch(`/api/events/${eventId}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Fehler beim Laden des Events");
        }
        return res.json();
      })
      .then((data) => setEvent(data))
      .catch((err) => setEventError(err.message || "Fehler beim Laden des Events"))
      .finally(() => setEventLoading(false));
  }, [eventId]);

  // Slots für Timeline generieren
  const slots = useMemo(() => generateHalfHourSlotsUTC(event?.startTime, event?.endTime), [event?.startTime, event?.endTime]);

  // Parse airports from event
  const eventAirports = useMemo(() => {
    if (!event?.airports) return [];
    return parseEventAirports(event.airports);
  }, [event?.airports]);

  const isMultiAirport = eventAirports.length > 1;

  if (eventLoading) return <div className="flex justify-center items-center h-64 text-muted-foreground">Lade Event...</div>;
  if (eventError || !event) return <div className="p-6 text-center text-red-500">{eventError || "Event nicht gefunden"}</div>;

  const handleSignupChanged = async () => {
    await Promise.all([
      timelineRef.current?.reload(),
      statsRef.current?.reload(),
      tableRef.current?.reload(),
    ]);
  };

  const handleExport = (airport?: string) => {
    const url = airport
      ? `/api/events/${eventId}/export?airport=${airport}`
      : `/api/events/${eventId}/export`;
    window.open(url, "_blank");
  };

  const handleAirportChange = (airport: string | undefined) => {
    // airport is already undefined for "all", no need to convert
    if (airport !== selectedAirport) {
      setSelectedAirport(airport);
    }
  };

  // Render table with or without tabs
  const renderContent = () => {
    if (isMultiAirport) {
      return (
        <AirportSignupTabs
          airports={eventAirports}
          eventId={Number(eventId)}
          onAirportChange={handleAirportChange}
          renderSignupsTable={(filteredSignups: SignupTableEntry[], airport?: string) => (
            <SignupsTable
              ref={tableRef}
              eventId={Number(event.id)}
              editable={canInFIR(event.firCode, "signups.manage")}
              event={event}
              columns={["cid", "name", "group", "airports", "availability", "preferredStations", "remarks"]}
              onRefresh={handleSignupChanged}
              selectedAirport={airport}
              preloadedSignups={filteredSignups}
            />
          )}
        />
      );
    } else {
      // Single airport - no tabs
      return (
        <SignupsTable
          ref={tableRef}
          eventId={Number(event.id)}
          editable={canInFIR(event.firCode, "signups.manage")}
          event={event}
          onRefresh={handleSignupChanged}
        />
      );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <EventHeader 
        event={event} 
        onRefresh={handleSignupChanged} 
        loading={eventLoading} 
      />
      
      <StatsCard ref={statsRef} eventId={Number(eventId)} />
      
      <AvailabilityTimeline
        ref={timelineRef}
        eventId={Number(eventId)}
        slots={slots}
        selectedAirport={selectedAirport}
      />
      

      <Card className="relative overflow-hidden">
        <CardHeader>
        <CardTitle className="flex justify-between">
          <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
            Angemeldete Teilnehmer
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  CSV Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export wählen</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport()}>
                  Alle Airports
                </DropdownMenuItem>
                {isMultiAirport && (
                  <>
                    <DropdownMenuSeparator />
                    {eventAirports.map(airport => (
                      <DropdownMenuItem key={airport} onClick={() => handleExport(airport)}>
                        {airport}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleSignupChanged} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4" /> <p className="hidden sm:block ml-1">Neu laden</p>
            </Button>
          </div>
        </CardTitle>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
      
      <SyncToSheetsButton eventId={parseInt(event.id.toString())} />
      
    </div>
  );
}

// Helper function (kann später in separate utils Datei ausgelagert werden)
function generateHalfHourSlotsUTC(startIso?: string, endIso?: string): { slotStart: string; slotEnd: string }[] {
  if (!startIso || !endIso) return [];
  const start = new Date(startIso);
  const end = new Date(endIso);
  const t = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()));
  
  const minutes = t.getUTCMinutes();
  if (minutes % 30 !== 0) {
    const delta = 30 - (minutes % 30);
    t.setUTCMinutes(minutes + delta);
  }
  
  const result: { slotStart: string; slotEnd: string }[] = [];
  while (t < end) {
    const slotStart = new Date(t);
    t.setUTCMinutes(t.getUTCMinutes() + 30);
    const slotEnd = new Date(t);
    
    if (slotEnd <= end) {
      const startHH = String(slotStart.getUTCHours()).padStart(2, "0");
      const startMM = String(slotStart.getUTCMinutes()).padStart(2, "0");
      const endHH = String(slotEnd.getUTCHours()).padStart(2, "0");
      const endMM = String(slotEnd.getUTCMinutes()).padStart(2, "0");
      
      result.push({
        slotStart: `${startHH}:${startMM}`,
        slotEnd: `${endHH}:${endMM}`
      });
    }
  }
  return result;
}