"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, AlertCircle } from "lucide-react";
import { useUser } from "@/hooks/useUser";

interface FIR {
  id: number;
  code: string;
  name: string;
}

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

const WEEKDAYS = [
  { value: 0, label: "Sonntag" },
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
];

interface WeeklyEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: WeeklyEventConfig | null;
  onSave: () => void;
  firs: FIR[];
}

export function WeeklyEventDialog({
  open,
  onOpenChange,
  config,
  onSave,
  firs,
}: WeeklyEventDialogProps) {
  const { user, isVATGERLead } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    weekday: 1,
    weeksOn: 1,
    weeksOff: 0,
    startDate: "",
    airports: [] as string[],
    airportInput: "",
    startTime: "",
    endTime: "",
    description: "",
    firId: null as number | null,
    requiresRoster: false,
    staffedStations: [] as string[],
    stationInput: "",
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
        firId: config.firId,
        requiresRoster: config.requiresRoster || false,
        staffedStations,
        stationInput: "",
        signupDeadlineHours: config.signupDeadlineHours || 24,
        enabled: config.enabled,
      });
    } else {
      // Create mode
      setFormData({
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
        firId: user?.fir?.id || null,
        requiresRoster: false,
        staffedStations: [],
        stationInput: "",
        signupDeadlineHours: 24,
        enabled: true,
      });
    }
    setError("");
  }, [config, user, open]);

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

  const handleAddStation = () => {
    const station = formData.stationInput.trim().toUpperCase();
    if (station && !formData.staffedStations.includes(station)) {
      setFormData({
        ...formData,
        staffedStations: [...formData.staffedStations, station],
        stationInput: "",
      });
    }
  };

  const handleRemoveStation = (station: string) => {
    setFormData({
      ...formData,
      staffedStations: formData.staffedStations.filter((s) => s !== station),
    });
  };

  const handleSave = async () => {
    setBusy(true);
    setError("");

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
        firId: formData.firId,
        requiresRoster: formData.requiresRoster,
        staffedStations:
          formData.staffedStations.length > 0 ? formData.staffedStations : null,
        signupDeadlineHours: formData.signupDeadlineHours,
        enabled: formData.enabled,
      };

      const url = config
        ? `/api/admin/discord/weekly-events/${config.id}`
        : "/api/admin/discord/weekly-events";

      const method = config ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onOpenChange(false);
        onSave();
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Fehler beim Speichern");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {config ? "Weekly Event bearbeiten" : "Neues Weekly Event erstellen"}
          </DialogTitle>
          <DialogDescription>
            Konfiguriere ein wiederkehrendes wöchentliches Event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Grundinformationen</h3>

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

            {/* FIR Selection - only for VATGER leads */}
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
                rows={3}
              />
            </div>
          </div>

          {/* Schedule Pattern */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Zeitplan</h3>

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
                <Label htmlFor="startTime">Startzeit (UTC)</Label>
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
                <Label htmlFor="endTime">Endzeit (UTC)</Label>
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
          </div>

          {/* Airports */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Flughäfen</h3>

            <div className="space-y-2">
              <Label>ICAO Codes hinzufügen</Label>
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
          </div>

          {/* Staffing Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Besetzung</h3>

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

            <div className="flex items-center space-x-2">
              <Switch
                id="requiresRoster"
                checked={formData.requiresRoster}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requiresRoster: checked })
                }
              />
              <Label htmlFor="requiresRoster">Rostering erforderlich</Label>
            </div>

            {formData.requiresRoster && (
              <div className="space-y-2 pl-6 border-l-2">
                <Label>Zu besetzende Stationen *</Label>
                <p className="text-xs text-muted-foreground">
                  Stationen, die bei diesem Weekly Event besetzt werden müssen
                </p>
                <div className="flex gap-2">
                  <Input
                    value={formData.stationInput}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stationInput: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="z.B. EDDM_TWR"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddStation();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddStation}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.staffedStations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.staffedStations.map((station) => (
                      <Badge key={station} variant="secondary" className="gap-1">
                        {station}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveStation(station)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enabled Status */}
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
