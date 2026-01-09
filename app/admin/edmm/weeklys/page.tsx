"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface WeeklyEventConfig {
  id: number;
  firId: number | null;
  fir?: { code: string; name: string };
  name: string;
  weekday: number;
  weeksOn: number;
  weeksOff: number;
  startDate: string;
  enabled: boolean;
  occurrences?: Array<{
    id: number;
    date: string;
  }>;
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

export default function WeeklyEventsPage() {
  const [configs, setConfigs] = useState<WeeklyEventConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WeeklyEventConfig | null>(
    null
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    weekday: 1,
    weeksOn: 1,
    weeksOff: 0,
    startDate: "",
    enabled: true,
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/discord/weekly-events");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      } else {
        setError("Fehler beim Laden der wöchentlichen Events");
      }
    } catch (err) {
      setError("Netzwerkfehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (config?: WeeklyEventConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        name: config.name,
        weekday: config.weekday,
        weeksOn: config.weeksOn,
        weeksOff: config.weeksOff,
        startDate: config.startDate.split("T")[0],
        enabled: config.enabled,
      });
    } else {
      setEditingConfig(null);
      setFormData({
        name: "",
        weekday: 1,
        weeksOn: 1,
        weeksOff: 0,
        startDate: new Date().toISOString().split("T")[0],
        enabled: true,
      });
    }
    setShowDialog(true);
    setError("");
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
        enabled: formData.enabled,
      };

      const url = editingConfig
        ? `/api/admin/discord/weekly-events/${editingConfig.id}`
        : "/api/admin/discord/weekly-events";

      const method = editingConfig ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowDialog(false);
        fetchConfigs();
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

  const handleDelete = async (id: number) => {
    if (!confirm("Möchtest du dieses wöchentliche Event wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/admin/discord/weekly-events/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchConfigs();
      } else {
        setError("Fehler beim Löschen");
      }
    } catch (err) {
      setError("Netzwerkfehler");
    }
  };

  const getPatternDescription = (config: WeeklyEventConfig) => {
    const weekdayName = WEEKDAYS.find((w) => w.value === config.weekday)?.label;
    if (config.weeksOff === 0) {
      return `Jeden ${weekdayName}`;
    }
    return `${config.weeksOn} ${config.weeksOn === 1 ? "Woche" : "Wochen"} aktiv, ${
      config.weeksOff
    } ${config.weeksOff === 1 ? "Woche" : "Wochen"} Pause`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Wöchentliche Events</h1>
          <p className="text-muted-foreground mt-1">
            Verwalte wiederkehrende Weekly Events mit flexiblen Rhythmen
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Weekly Event
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
          </Card>
        ) : configs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Noch keine wöchentlichen Events konfiguriert
              </p>
            </CardContent>
          </Card>
        ) : (
          configs.map((config) => (
            <Card key={config.id} className={!config.enabled ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {config.name}
                      {!config.enabled && (
                        <Badge variant="secondary">Deaktiviert</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {getPatternDescription(config)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(config)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start:</span>
                    <span>
                      {format(new Date(config.startDate), "dd.MM.yyyy", {
                        locale: de,
                      })}
                    </span>
                  </div>
                </div>

                {config.occurrences && config.occurrences.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">
                      Nächste Termine:
                    </p>
                    <div className="space-y-1">
                      {config.occurrences.slice(0, 5).map((occ) => (
                        <div
                          key={occ.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <span>
                            {format(new Date(occ.date), "dd.MM.yyyy", {
                              locale: de,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Event bearbeiten" : "Neues Weekly Event erstellen"}
            </DialogTitle>
            <DialogDescription>
              Konfiguriere ein wiederkehrendes wöchentliches Event mit flexiblem Rhythmus
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="z.B. München Mittwoch, Frankfurt Friday"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weekday">Wochentag</Label>
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
                <Label htmlFor="startDate">Startdatum</Label>
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
                <Label htmlFor="weeksOn">Wochen aktiv</Label>
                <Input
                  id="weeksOn"
                  type="number"
                  min="1"
                  value={formData.weeksOn}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weeksOn: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Anzahl aufeinanderfolgender Wochen
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeksOff">Wochen Pause</Label>
                <Input
                  id="weeksOff"
                  type="number"
                  min="0"
                  value={formData.weeksOff}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weeksOff: parseInt(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  0 = jede Woche, 1 = eine Woche Pause, etc.
                </p>
              </div>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
