"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, Loader2, ArrowLeft, DeleteIcon, Trash2Icon, X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventTimeSelector from "./TimeSelector";
import StationSelector from "./StationSelector";
import { Event } from "@/types";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface FormData {
  name: string;
  description: string;
  bannerUrl: string;
  startTime: string;
  endTime: string;
  airports: string[]; // Changed to array for multi-airport support
  rosterUrl?: string;
  staffedStations: string[];
  status: Event["status"];
  deadline?: string;
  fir: string;
}

interface Props {
  event?: Event | null;
  fir?: { 
    code: string
    name: string
  } | null;
  initialDate?: string;
}

const STATUS_DESCRIPTIONS: Record<Event["status"], string> = {
  DRAFT: "Entwurf: Das Event ist nur für Admins sichtbar und kann bearbeitet werden.",
  PLANNING: "Planung: Event sichtbar, Anmeldung noch nicht geöffnet.",
  SIGNUP_OPEN: "Anmeldung offen: Nutzer können sich für das Event anmelden.",
  SIGNUP_CLOSED: "Anmeldung geschlossen: Keine neuen Anmeldungen mehr möglich.",
  ROSTER_PUBLISHED: "",
  CANCELLED: "Abgesagt: Das Event findet nicht statt."
};

export default function AdminEventForm({ event, fir, initialDate }: Props) {
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
    airports: [], // Changed to empty array
    staffedStations: [],
    status: "DRAFT",
    fir: "",
  });

  const { isVATGERLead } = useUser();

  // Initialisierung basierend auf Event (Edit-Modus) oder leere Werte (Create-Modus)
  // Note: We intentionally only depend on event?.id and initialDate, not the full event object.
  // This prevents re-initializing the form when the event object is recreated with the same data,
  // which would overwrite user edits. We only want to reinitialize when switching to a different event.
    useEffect(() => {
      if (!event) {
        // Create mode
        const now = new Date();
        let defaultStart: Date;
        
        // Use initialDate if provided from calendar, otherwise use tomorrow
        if (initialDate) {
          defaultStart = new Date(initialDate);
          defaultStart.setHours(10, 0, 0, 0); // Set to 10:00 AM
        } else {
          defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }
        
        const defaultEnd = new Date(defaultStart.getTime() + 2 * 60 * 60 * 1000);
        setFormData({
          name: "",
          description: "",
          bannerUrl: "",
          startTime: defaultStart.toISOString(),
          endTime: defaultEnd.toISOString(),
          airports: [], // Changed to empty array
          staffedStations: [],
          status: "DRAFT", // Events from calendar start as DRAFT
          rosterUrl: "",
          fir: "",
        });
        return;
      }
    
      // Edit mode (wird nur 1x pro Event gesetzt)
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
    
      setFormData({
        name: event.name || "",
        description: event.description || "",
        bannerUrl: event.bannerUrl || "",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        airports: Array.isArray(event.airports) 
          ? event.airports 
          : (event.airports ? [event.airports] : []), // Handle both array and string
        staffedStations: event.staffedStations || [],
        status: (event.status as Event["status"]) ?? "DRAFT",
        rosterUrl: event.rosterlink || "",
        deadline: event.signupDeadline
          ? new Date(event.signupDeadline).toISOString()
          : "",
        fir: event.firCode || "",
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id, initialDate]);


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
  
  // Handlers for airport management
  const [newAirport, setNewAirport] = useState("");
  
  const handleAddAirport = () => {
    const airport = newAirport.trim().toUpperCase();
    if (!airport) return;
    
    if (airport.length !== 4) {
      toast.error("ICAO-Code muss genau 4 Zeichen lang sein");
      return;
    }
    
    if (formData.airports.includes(airport)) {
      toast.error("Airport bereits hinzugefügt");
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      airports: [...prev.airports, airport]
    }));
    setNewAirport("");
  };
  
  const handleRemoveAirport = (airport: string) => {
    setFormData(prev => ({
      ...prev,
      airports: prev.airports.filter(a => a !== airport)
    }));
  };
  
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
        airports: formData.airports.map(a => a.trim().toUpperCase()), // Support multiple airports
        staffedStations: formData.staffedStations,
        status: formData.status,
        rosterlink: formData.rosterUrl?.trim() || null,
        signupDeadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        firCode: isVATGERLead() ? formData.fir : null,
      };

      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/api/events/${event!.id}` : "/api/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          message = data.message || message;
        } catch {
          const text = await res.text().catch(() => "");
          if (text) message = text;
        }
        throw new Error(message);
      }
      if(!isEdit) {
        router.push(`/admin/events`);
      }
      toast.success(`Event erfolgreich ${isEdit ? "aktualisiert" : "erstellt"}`);
      router.refresh();
    } catch (err: unknown) {
      console.error("Error saving event:", err);
  
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Unbekannter Fehler beim Speichern";
  
      toast.error(message);
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
    
    if (!formData.airports || formData.airports.length === 0) {
      setError("Mindestens ein Airport ist erforderlich");
      setActiveTab("basic");
      return false;
    }

    // Validate all airports are 4 characters
    for (const airport of formData.airports) {
      if (!airport.trim() || airport.trim().length !== 4) {
        setError(`Ungültiger ICAO-Code: ${airport}. Alle Codes müssen 4 Zeichen lang sein.`);
        setActiveTab("basic");
        return false;
      }
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
    setError("")
    if (!confirm("Event wirklich löschen?")) return;
    try {
      if(!event) return;
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      router.push("/admin/events");
    } catch (err) {
      toast.error("Fehler beim Löschen des Events");
    }
  };

  
  

  return (
    <div className="container mx-auto py-6 max-w-4xl px-4">
        {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEdit ? "Event bearbeiten" : "Neues Event erstellen"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit 
              ? "Aktualisiere die Event-Details" 
              : `Erstelle ein neues Event ${isVATGERLead() ? "in " + formData.fir : "der " + fir?.name}`
            }
          </p>
        </div>

        {/* FIR Switcher */}
        {isVATGERLead() && (
          <Select
            defaultValue={fir?.code || event?.firCode}
            onValueChange={(value) => {
              setFormData((prev) => ({ ...prev, fir: value }));
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="FIR auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EDMM">EDMM</SelectItem>
              <SelectItem value="EDGG">EDGG</SelectItem>
              <SelectItem value="EDWW">EDWW</SelectItem>
            </SelectContent>
          </Select>
        )}
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
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Beschreibe dein Event für die Teilnehmer..."
                    disabled={isSaving}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bannerUrl">Banner URL</Label>
                  <Input
                    id="bannerUrl"
                    name="bannerUrl"
                    type="url"
                    value={formData.bannerUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/banner.jpg"
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="airport">Event-Airports (ICAO) *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="airport"
                      value={newAirport}
                      onChange={(e) => setNewAirport(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAirport();
                        }
                      }}
                      placeholder="z.B. EDDM"
                      disabled={isSaving}
                      className="uppercase"
                      maxLength={4}
                    />
                    <Button
                      type="button"
                      onClick={handleAddAirport}
                      disabled={isSaving || !newAirport.trim()}
                      variant="outline"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.airports.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.airports.map((airport) => (
                        <Badge 
                          key={airport} 
                          variant="secondary"
                          className="px-3 py-1 gap-2"
                        >
                          {airport}
                          <button
                            type="button"
                            onClick={() => handleRemoveAirport(airport)}
                            className="ml-1 hover:text-destructive"
                            disabled={isSaving}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Fügen Sie alle Airports hinzu, die bei diesem Event geöffnet werden
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => {
                      if (!value) return;
                      setFormData((prev) => ({ ...prev, status: value as Event["status"] }))
                    }}
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
                    <p className="text-xs text-muted-foreground">
                      Eine Benachrichtigung an die Nutzer wird hier nicht Versendet. Bitte Plan über Button in der Eventkarte veröffentlichen.
                    </p>
                  </div>
                  
                )}
                {formData.status === "SIGNUP_OPEN" && (
                  <div className="space-y-2">
                    <Label htmlFor="rosterUrl">Deadline</Label>
                    <Input
                      id="deadline"
                      name="deadline"
                      type="date"
                      value={formData.deadline ? formData.deadline.split("T")[0] : ""}
                      onChange={handleChange}
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
                {formData.airports.length > 0 ? (
                  <StationSelector
                    airport={formData.airports[0]}
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
            onClick={() => router.push("/admin/events")}
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