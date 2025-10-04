"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, Loader2, ArrowLeft, DeleteIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventTimeSelector from "./TimeSelector";
import StationSelector from "./StationSelector";

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
  rosterlink: string | null;
  status: "DRAFT" | "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "CANCELLED" | string;
}

interface FormData {
  name: string;
  description: string;
  bannerUrl: string;
  startTime: string;
  endTime: string;
  airport: string;
  rosterUrl?: string;
  staffedStations: string[];
  status: Event["status"];
}

interface Props {
  event?: Event | null;
}

const STATUS_DESCRIPTIONS: Record<Event["status"], string> = {
  DRAFT: "Entwurf: Das Event ist nur für Admins sichtbar und kann bearbeitet werden.",
  PLANNING: "Planung: Event sichtbar, Anmeldung noch nicht geöffnet.",
  SIGNUP_OPEN: "Anmeldung offen: Nutzer können sich für das Event anmelden.",
  SIGNUP_CLOSED: "Anmeldung geschlossen: Keine neuen Anmeldungen mehr möglich.",
  ROSTER_PUBLISHED: "Roster veröffentlicht: Der Besetzungsplan wurden veröffentlicht.",
  CANCELLED: "Abgesagt: Das Event findet nicht statt."
};

export default function AdminEventForm({ event }: Props) {
  const router = useRouter();
  const isEdit = Boolean(event);
  
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    bannerUrl: "",
    startTime: "",
    endTime: "",
    airport: "",
    staffedStations: [],
    status: "PLANNING",
  });

  // Initialisierung basierend auf Event (Edit-Modus) oder leere Werte (Create-Modus)
  useEffect(() => {
    if (event) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      setFormData({
        name: event.name || "",
        description: event.description || "",
        bannerUrl: event.bannerUrl || "",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        airport: event.airports?.toString() || "",
        staffedStations: event.staffedStations || [],
        status: (event.status as Event["status"]) || "PLANNING",
        rosterUrl: event.rosterlink || "",
      });
    } else {
      // Setze Standardwerte für neues Event
      const now = new Date();
      const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Morgen
      const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000); // +2 Stunden
      
      setFormData({
        name: "",
        description: "",
        bannerUrl: "",
        startTime: defaultStart.toISOString(),
        endTime: defaultEnd.toISOString(),
        airport: "",
        staffedStations: [],
        status: "PLANNING",
        rosterUrl: "",
      });
    }
  }, [event]);

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
        status: formData.status,
        rosterlink: formData.rosterUrl?.trim() || null,
      };

      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/api/events/${event!.id}` : "/api/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }

      router.push("/admin");
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
      setActiveTab("basic");
      return false;
    }
    
    if (!formData.airport.trim() || formData.airport.trim().length !== 4) {
      setError("Bitte geben Sie einen gültigen ICAO-Code (4 Zeichen) ein");
      setActiveTab("basic");
      return false;
    }

    const startTime = new Date(formData.startTime);
    const endTime = new Date(formData.endTime);
    
    if (startTime >= endTime) {
      setError("Endzeit muss nach der Startzeit liegen");
      setActiveTab("time");
      return false;
    }

    return true;
  };

  const handleDelete = async () => {
    if (!confirm("Event wirklich löschen?")) return;
    try {
      if(!event) return;
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      router.push("/admin");
    } catch (err) {
      setError("Fehler beim Löschen des Events");
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Event bearbeiten" : "Neues Event erstellen"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit 
              ? "Aktualisiere die Event-Details" 
              : "Erstelle ein neues Event der FIR München"
            }
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="airport">Event-Airport (ICAO) *</Label>
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
                    
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as Event["status"] }))
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">DRAFT – Entwurf</SelectItem>
                      <SelectItem value="PLANNING">PLANNING – Planung</SelectItem>
                      <SelectItem value="SIGNUP_OPEN">SIGNUP_OPEN – Anmeldung offen</SelectItem>
                      <SelectItem value="SIGNUP_CLOSED">SIGNUP_CLOSED – Anmeldung geschlossen</SelectItem>
                      <SelectItem value="ROSTER_PUBLISHED">ROSTER_PUBLISHED – Roster veröffentlicht</SelectItem>
                      <SelectItem value="CANCELLED">CANCELLED – Abgesagt</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_DESCRIPTIONS[formData.status]}
                  </p>
                </div>

                {formData.status === "ROSTER_PUBLISHED" && (
                  <div className="space-y-2">
                    <Label htmlFor="rosterUrl">Roster URL</Label>
                    <Input
                      id="rosterUrl"
                      name="rosterUrl"
                      type="url"
                      value={formData.rosterUrl}
                      onChange={handleChange}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      disabled={isSaving}
                    />
                  </div>
                )}
                
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zeit & Datum Tab */}
          <TabsContent value="time">
            <Card>
              <CardHeader>
                <CardTitle>Zeitplan</CardTitle>
                <CardDescription>
                  Wann findet das Event statt?
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
                <CardTitle>Zu besetzende Stationen</CardTitle>
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
                    Bitte gebe zuerst einen gültigen ICAO-Code im Tab Grunddaten ein.
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
            onClick={() => router.push("/admin")}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
          {isEdit && 
          <Button type="button" variant={"destructive"} onClick={handleDelete}>
            <Trash2Icon />
          </Button>}
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Event aktualisieren" : "Event erstellen"}
          </Button>
          
        </div>
      </form>
    </div>
  );
}