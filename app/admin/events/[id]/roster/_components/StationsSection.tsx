"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import type { Station } from "@/lib/stations/types";
import type { ApiRoster, Assignment } from "../_lib/rosterTypes";

interface StationsSectionProps {
  /** Beim Öffnen des Dialogs die Eingaben auf den gespeicherten Stand setzen */
  open: boolean;
  eventId: number;
  eventAirports: string[];
  roster: ApiRoster;
  assignments: Assignment[];
  onUpdated: () => void;
  /** Schließt den umgebenden Dialog nach dem Speichern */
  onDone: () => void;
}

/**
 * Stationen und Zeitraster eines bestehenden Rosters bearbeiten.
 * Abschnitt der Roster-Einstellungen – die Dialoghülle liegt beim Aufrufer.
 */
export function StationsSection({
  open,
  eventId,
  eventAirports,
  roster,
  assignments,
  onUpdated,
  onDone,
}: StationsSectionProps) {
  const [stations, setStations] = useState<string[]>([]);
  const [slotMinutes, setSlotMinutes] = useState(roster.slotMinutes);
  const [customStation, setCustomStation] = useState("");
  const [datahubStations, setDatahubStations] = useState<Station[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStations(roster.stations.map((s) => s.callsign));
      setSlotMinutes(roster.slotMinutes);
      setCustomStation("");
    }
  }, [open, roster]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          eventAirports.map(async (airport) => {
            const res = await fetch(`/api/stations?airport=${airport}`);
            if (!res.ok) return [] as Station[];
            const data = await res.json();
            return (data.stations ?? []) as Station[];
          })
        );
        if (!cancelled) setDatahubStations(results.flat());
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventAirports]);

  const suggestions = useMemo(
    () => datahubStations.filter((s) => !stations.includes(s.callsign.toUpperCase())),
    [datahubStations, stations]
  );

  const assignmentCountFor = (callsign: string) => {
    const station = roster.stations.find((s) => s.callsign === callsign);
    if (!station) return 0;
    return assignments.filter((a) => a.stationId === station.id).length;
  };

  const removedWithAssignments = roster.stations
    .filter((s) => !stations.includes(s.callsign))
    .map((s) => ({
      callsign: s.callsign,
      count: assignments.filter((a) => a.stationId === s.id).length,
    }))
    .filter((s) => s.count > 0);

  const addStation = (callsign: string) => {
    const cs = callsign.trim().toUpperCase();
    if (!cs) return;
    if (stations.includes(cs)) {
      toast.info(`${cs} ist bereits in der Liste`);
      return;
    }
    setStations((prev) => [...prev, cs]);
    setCustomStation("");
  };

  const save = async () => {
    if (stations.length === 0) {
      toast.error("Mindestens eine Station wird benötigt");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stations, slotMinutes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Fehler beim Speichern");
      }
      toast.success("Roster aktualisiert");
      onUpdated();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Stationen ({stations.length})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {stations.map((cs) => {
                const count = assignmentCountFor(cs);
                return (
                  <Badge key={cs} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                    {cs}
                    {count > 0 && (
                      <span className="text-[10px] text-muted-foreground">({count})</span>
                    )}
                    <button
                      onClick={() => setStations((prev) => prev.filter((s) => s !== cs))}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`${cs} entfernen`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>

          {removedWithAssignments.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Beim Speichern werden Zuweisungen gelöscht:{" "}
                {removedWithAssignments
                  .map((s) => `${s.callsign} (${s.count})`)
                  .join(", ")}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Station hinzufügen…"
              value={customStation}
              onChange={(e) => setCustomStation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addStation(customStation);
                }
              }}
              list="roster-station-suggestions"
            />
            <datalist id="roster-station-suggestions">
              {suggestions.map((s) => (
                <option key={s.callsign} value={s.callsign} />
              ))}
            </datalist>
            <Button variant="outline" onClick={() => addStation(customStation)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Zeitraster</Label>
            <div className="grid grid-cols-2 gap-2">
              {[15, 30].map((m) => (
                <Button
                  key={m}
                  variant={slotMinutes === m ? "default" : "outline"}
                  onClick={() => setSlotMinutes(m)}
                >
                  {m} Minuten
                </Button>
              ))}
            </div>
          </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Stationen & Raster speichern
        </Button>
      </div>
    </div>
  );
}
