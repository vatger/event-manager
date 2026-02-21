"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircleIcon, ArrowLeft, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/useUser";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import StationSelector from "@/app/admin/events/_components/StationSelector";


interface WeeklyEventConfig {
  id: number;
  firId: number | null;
  fir?: { code: string; name: string };
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
  enabled: boolean;
}

interface FIR {
  id: number;
  code: string;
  name: string;
}

interface FormData {
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  airports: string[];
  airportInput: string;
  startTime: string;
  endTime: string;
  description: string;
  bannerUrl: string; // Added for banner image URL
  firId: number | null;
  requiresRoster: boolean;
  staffedStations: string[];
  signupDeadlineHours: number;
  enabled: boolean;
}

interface Props {
  config?: WeeklyEventConfig | null;
  firs: FIR[];
}

const WEEKDAYS = [
  { value: 0, label: "Sonntag" },
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
];

export default function AdminWeeklyForm({ config, firs }: Props) {
  const router = useRouter();
  const isEdit = Boolean(config);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const { user, isVATGERLead } = useUser();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    weekday: 1,
    weeksOn: 1,
    weeksOff: 0,
    startDate: new Date().toISOString().split("T")[0],
    airports: [],
    airportInput: "",
    startTime: "",
    endTime: "",
    description: "",
    bannerUrl: "", // Added for banner image URL
    firId: null,
    requiresRoster: false,
    staffedStations: [],
    signupDeadlineHours: 24,
    enabled: true,
  });

  useEffect(() => {
    if (config) {
      // Edit mode
      const airports =
        typeof config.airports === "string"
          ? JSON.parse(config.airports)
          : config.airports || [];
      const staffedStations =
        typeof config.staffedStations === "string"
          ? JSON.parse(config.staffedStations)
          : config.staffedStations || [];

      setFormData({
        name: config.name,
        weekday: config.weekday,
        weeksOn: config.weeksOn,
        weeksOff: config.weeksOff,
        startDate: config.startDate.split("T")[0],
        airports,
        airportInput: "",
        startTime: config.startTime || "",
        endTime: config.endTime || "",
        description: config.description || "",
        bannerUrl: (config as any).bannerUrl || "", // Added for banner image URL
        firId: config.firId,
        requiresRoster: config.requiresRoster || false,
        staffedStations,
        signupDeadlineHours: config.signupDeadlineHours || 24,
        enabled: config.enabled,
      });
    } else {
      // Create mode - set default FIR
      setFormData((prev) => ({
        ...prev,
        firId: user?.fir?.id || null,
      }));
    }
  }, [config, user]);

  const handleAddAirport = () => {
    const icao = formData.airportInput.trim().toUpperCase();
    if (icao && icao.length === 4 && !formData.airports.includes(icao)) {
      setFormData({
        ...formData,
        airports: [...formData.airports, icao],
        airportInput: "",
      });
    }
  };

  const handleRemoveAirport = (icao: string) => {
    setFormData({
      ...formData,
      airports: formData.airports.filter((a) => a !== icao),
    });
  };

  const handleStationsChange = useCallback((stations: string[]) => {
    setFormData(prev => ({ ...prev, staffedStations: stations }));
  }, []);

  const formValidation = (): boolean => {
    if (!formData.name.trim()) {
      setError("Name ist erforderlich");
      setActiveTab("basic");
      return false;
    }

    if (formData.requiresRoster && formData.staffedStations.length === 0) {
      setError("Bei aktiviertem Rostering müssen zu besetzende Stationen angegeben werden");
      setActiveTab("staffing");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formValidation()) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        name: formData.name,
        weekday: formData.weekday,
        weeksOn: formData.weeksOn,
        weeksOff: formData.weeksOff,
        startDate: new Date(formData.startDate).toISOString(),
        airports: formData.airports.length > 0 ? formData.airports : null,
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        description: formData.description || null,
        bannerUrl: formData.bannerUrl || null, // Added for banner image URL
        firId: formData.firId,
        requiresRoster: formData.requiresRoster,
        staffedStations:
          formData.staffedStations.length > 0 ? formData.staffedStations : null,
        signupDeadlineHours: formData.signupDeadlineHours,
        enabled: formData.enabled,
      };

      const method = isEdit ? "PATCH" : "POST";
      const url = isEdit
        ? `/api/admin/discord/weekly-events/${config!.id}`
        : "/api/admin/discord/weekly-events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Fehler beim Speichern");
      }

      toast.success(
        `Weekly Event erfolgreich ${isEdit ? "aktualisiert" : "erstellt"}`
      );
      router.push("/admin/events");
      router.refresh();
    } catch (err: unknown) {
      console.error("Error saving weekly event:", err);
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

  const handleDelete = async () => {
    setError("");
    if (!confirm("Weekly Event wirklich löschen?")) return;
    try {
      if (!config) return;
      const res = await fetch(`/api/admin/discord/weekly-events/${config.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      toast.success("Weekly Event gelöscht");
      router.push("/admin/events");
      router.refresh();
    } catch (err) {
      toast.error("Fehler beim Löschen des Weekly Events");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin/events")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEdit ? "Weekly Event bearbeiten" : "Neues Weekly Event"}
            </h1>
            <p className="text-muted-foreground">
              {isEdit
                ? "Bearbeite die Konfiguration des wiederkehrenden Events"
                : "Erstelle ein neues wiederkehrendes wöchentliches Event"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Speichert..." : isEdit ? "Aktualisieren" : "Erstellen"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${formData.requiresRoster ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="basic">Grunddaten</TabsTrigger>
          <TabsTrigger value="schedule">Zeitplan</TabsTrigger>
          {formData.requiresRoster && (
            <TabsTrigger value="staffing">Besetzung</TabsTrigger>
          )}
        </TabsList>

        {/* Basic Information Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grundinformationen</CardTitle>
              <CardDescription>
                Name und Beschreibung des Weekly Events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="z.B. München Mittwoch, Frankfurt Friday"
                />
              </div>

              {isVATGERLead() && (
                <div className="space-y-2">
                  <Label htmlFor="fir">FIR *</Label>
                  <Select
                    value={formData.firId?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        firId: value ? parseInt(value) : null,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="FIR auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {firs.map((fir) => (
                        <SelectItem key={fir.id} value={fir.id.toString()}>
                          {fir.name} ({fir.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optionale Beschreibung des Weekly Events"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bannerUrl">Banner URL (optional)</Label>
                <Input
                  id="bannerUrl"
                  type="url"
                  value={formData.bannerUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, bannerUrl: e.target.value })
                  }
                  placeholder="https://example.com/banner.jpg"
                />
                <p className="text-sm text-muted-foreground">
                  URL eines Banner-Bildes, das auf der öffentlichen Weekly-Seite angezeigt wird
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="requiresRoster"
                  checked={formData.requiresRoster}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requiresRoster: checked })
                  }
                />
                <Label htmlFor="requiresRoster">Roster erforderlich</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Wenn aktiviert, können sich Nutzer anmelden und ein Roster wird erstellt
              </p>

              <div className="space-y-2">
                <Label>Flughäfen (ICAO Codes)</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.airportInput}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        airportInput: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="z.B. EDDM"
                    maxLength={4}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAirport();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddAirport} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.airports.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.airports.map((icao) => (
                      <Badge key={icao} variant="secondary" className="gap-1">
                        {icao}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveAirport(icao)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
                <Label htmlFor="enabled">Aktiviert</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zeitplan</CardTitle>
              <CardDescription>
                Konfiguriere das wiederkehrende Muster und die Zeiten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weekday">Wochentag *</Label>
                  <Select
                    value={formData.weekday.toString()}
                    onValueChange={(value) =>
                      setFormData({ ...formData, weekday: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startDate">Startdatum *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Startzeit (lcl)</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">Endzeit (lcl)</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weeksOn">Wochen aktiv *</Label>
                  <Input
                    id="weeksOn"
                    type="number"
                    min="1"
                    value={formData.weeksOn}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weeksOn: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Anzahl aufeinanderfolgender Wochen
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weeksOff">Wochen Pause *</Label>
                  <Input
                    id="weeksOff"
                    type="number"
                    min="0"
                    value={formData.weeksOff}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weeksOff: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = jede Woche, 1 = eine Woche Pause, etc.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staffing Tab - Only shown if roster is required */}
        {formData.requiresRoster && (
        <TabsContent value="staffing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Besetzung</CardTitle>
              <CardDescription>
                Konfiguriere die Besetzungsanforderungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signupDeadlineHours">
                  Anmeldeschluss (Stunden vorher)
                </Label>
                <Input
                  id="signupDeadlineHours"
                  type="number"
                  min="1"
                  max="168"
                  value={formData.signupDeadlineHours}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      signupDeadlineHours: parseInt(e.target.value) || 24,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Zu besetzende Stationen *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Stationen, die bei diesem Weekly Event besetzt werden müssen
                </p>
                {formData.airports.length > 0 ? (
                  <StationSelector
                    airport={formData.airports[0]}
                    selectedStations={formData.staffedStations}
                    onStationsChange={handleStationsChange}
                    disabled={isSaving}
                    firCode={firs.find(f => f.id === formData.firId)?.code}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                    Bitte gebe zuerst einen Flughafen im Tab Grunddaten ein, um Stationsvorschläge zu erhalten.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </form>
  );
}
