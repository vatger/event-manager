// app/admin/events/create/page.tsx und app/admin/events/[id]/edit/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, Loader2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventTimeSelector from "@/app/admin/_components/TimeSelector";
import StationSelector from "@/app/admin/_components/StationSelector";

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
  status: "DRAFT" | "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "CANCELLED" | string;
}

interface FormData {
  name: string;
  description: string;
  bannerUrl: string;
  startTime: string;
  endTime: string;
  airport: string;
  staffedStations: string[];
}

interface Props {
  params?: {
    id?: string;
  };
}

export default function AdminEventPage({ params }: Props) {
  const router = useRouter();
  const eventId = params?.id;
  const isEdit = Boolean(eventId);
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    bannerUrl: "",
    startTime: "",
    endTime: "",
    airport: "",
    staffedStations: [],
  });

  // Lade Event-Daten für Edit-Modus
  useEffect(() => {
    if (!isEdit) return;

    const loadEvent = async () => {
      try {
        // Hier API-Aufruf für Event-Daten
        const mockEvent: Event = {
          id: eventId!,
          name: "Team Meeting",
          description: "Wöchentliches Team Meeting",
          bannerUrl: "https://example.com/banner.jpg",
          airports: ["EDDM"],
          startTime: new Date(Date.now() + 86400000).toISOString(), // Morgen
          endTime: new Date(Date.now() + 90000000).toISOString(), // +1 Stunde
          staffedStations: ["EDDM_GND", "EDDM_TWR"],
          signupDeadline: null,
          registrations: 0,
          status: "DRAFT"
        };

        // Simuliere Ladezeit
        await new Promise(resolve => setTimeout(resolve, 1000));

        setFormData({
          name: mockEvent.name,
          description: mockEvent.description,
          bannerUrl: mockEvent.bannerUrl,
          startTime: mockEvent.startTime,
          endTime: mockEvent.endTime,
          airport: mockEvent.airports[0] || "",
          staffedStations: mockEvent.staffedStations,
        });
      } catch (err) {
        setError("Fehler beim Laden des Events");
        console.error("Error loading event:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvent();
  }, [isEdit, eventId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTimeChange = useCallback((startTime: Date, endTime: Date) => {
    setFormData(prev => ({
      ...prev,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    }));
  }, []);

  const handleStationsChange = useCallback((staffedStations: string[]) => {
    setFormData(prev => ({ ...prev, staffedStations }));
  }, []);

  const initialStartTime = useMemo(() => 
    formData.startTime ? new Date(formData.startTime) : undefined, 
    [formData.startTime]
  );
  
  const initialEndTime = useMemo(() => 
    formData.endTime ? new Date(formData.endTime) : undefined, 
    [formData.endTime]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValidation()) return;
    
    setIsSaving(true);
    setError("");

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        bannerUrl: formData.bannerUrl.trim(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        airports: [formData.airport.trim().toUpperCase()],
        staffedStations: formData.staffedStations,
      };

      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/api/events/${eventId}` : "/api/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      router.push("/admin/events");
      router.refresh();
    } catch (err) {
      setError(`Fehler beim ${isEdit ? "Speichern" : "Erstellen"} des Events! ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
      console.error("Error saving event:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const formValidation = (): boolean => {
    if (!formData.name.trim()) {
      setError("Event Name ist erforderlich");
      return false;
    }
    
    if (!formData.airport.trim() || formData.airport.trim().length !== 4) {
      setError("Bitte geben Sie einen gültigen ICAO-Code (4 Zeichen) ein");
      return false;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);
    
    if (startTime >= endTime) {
      setError("Endzeit muss nach der Startzeit liegen");
      return false;
    }

    return true;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Lade Event...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/admin")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Event bearbeiten" : "Neues Event erstellen"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Aktualisiere die Event-Details" : "Erstelle ein neues Event für die Community"}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Grunddaten</TabsTrigger>
            <TabsTrigger value="time">Zeit & Datum</TabsTrigger>
            <TabsTrigger value="stations">Stationen</TabsTrigger>
          </TabsList>

          {/* Grunddaten Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Information</CardTitle>
                <CardDescription>
                  Grundlegende Informationen über dein Event
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Event Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="z. B. Munich Overload"
                    required
                    disabled={isSaving}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung *</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Beschreibe dein Event für die Teilnehmer..."
                    required
                    disabled={isSaving}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bannerUrl">Banner URL *</Label>
                  <Input
                    id="bannerUrl"
                    name="bannerUrl"
                    type="url"
                    value={formData.bannerUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/banner.jpg"
                    required
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL zu einem Banner-Bild für dein Event (empfohlen: 1200x400px)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="airport">Haupt-Airport (ICAO) *</Label>
                  <Input
                    id="airport"
                    name="airport"
                    value={formData.airport}
                    onChange={handleChange}
                    placeholder="EDDM"
                    required
                    disabled={isSaving}
                    className="uppercase"
                    maxLength={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    4-stelliger ICAO-Code des Haupt-Airports
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zeit & Datum Tab */}
          <TabsContent value="time">
            <Card>
              <CardHeader>
                <CardTitle>Zeitplan</CardTitle>
                <CardDescription>
                  Wann soll dein Event starten und enden?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTimeSelector 
                  onTimeChange={handleTimeChange}
                  initialStartTime={initialStartTime}
                  initialEndTime={initialEndTime}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stationen Tab */}
          <TabsContent value="stations">
            <Card>
              <CardHeader>
                <CardTitle>Stationen Konfiguration</CardTitle>
                <CardDescription>
                  Welche Stationen sollen während des Events besetzt werden?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {formData.airport ? (
                  <StationSelector
                    airport={formData.airport}
                    selectedStations={formData.staffedStations}
                    onStationsChange={handleStationsChange}
                    disabled={isSaving}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Bitte gib zuerst einen Airport im Tab "Grunddaten" ein
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 mt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/events")}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
          <Button type="submit" disabled={isSaving} size="lg">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Event aktualisieren" : "Event erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}