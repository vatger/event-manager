"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import type { Station } from "@/lib/stations/types";
import type { ApiRoster, Assignment } from "../_lib/rosterTypes";
import { SelectedStationList, StationPicker } from "./StationPicker";

interface StationsSectionProps {
  /** Beim Öffnen des Dialogs die Eingaben auf den gespeicherten Stand setzen */
  open: boolean;
  eventId: number;
  eventAirports: string[];
  /** FIR des Events – CTR-Stationen hängen an der FIR, nicht an einem Airport */
  firCode?: string;
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
  firCode,
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
        // CTR-Stationen hängen an der FIR, nicht an einem einzelnen Airport
        // (z. B. EDGG_CTR) – ohne eigenen Abruf über den FIR-Code tauchen sie
        // in der Auswahl nie auf, weil sie zu keinem Event-Airport passen.
        const airports = firCode ? [...eventAirports, firCode] : eventAirports;
        const results = await Promise.all(
          airports.map(async (airport) => {
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
  }, [eventAirports, firCode]);

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
              Ausgewählt ({stations.length})
            </Label>
            <SelectedStationList
              selected={stations}
              eventAirports={eventAirports}
              onRemove={(cs) => setStations((prev) => prev.filter((s) => s !== cs))}
              countFor={assignmentCountFor}
            />
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

          {/* Auswahl nach Airport gegliedert – bei mehreren Plätzen ist eine
              gemischte Liste unbrauchbar. */}
          {datahubStations.length > 0 && (
            <StationPicker
              selected={stations}
              available={datahubStations}
              eventAirports={eventAirports}
              onToggle={(cs) =>
                setStations((prev) =>
                  prev.includes(cs) ? prev.filter((s) => s !== cs) : [...prev, cs]
                )
              }
              countFor={assignmentCountFor}
            />
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
