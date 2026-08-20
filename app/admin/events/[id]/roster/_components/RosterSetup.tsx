"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2, Plus } from "lucide-react";
import type { Station } from "@/lib/stations/types";
import { SelectedStationList, StationPicker } from "./StationPicker";
import { extractStationGroup, STATION_GROUP_ORDER } from "@/lib/weeklys/stationUtils";

interface RosterSetupProps {
  eventId: number;
  eventAirports: string[];
  /** Vorauswahl aus Event.staffedStations */
  staffedStations: string[];
  defaultSlotMinutes: number;
  onCreated: () => void;
}

/**
 * Schritt 1 des Roster-Editors: Stationen bestätigen und Rastergröße wählen.
 * Die im Event hinterlegten Stationen sind vorausgewählt, weitere können
 * aus dem Datahub oder als Freitext ergänzt werden.
 */
export function RosterSetup({
  eventId,
  eventAirports,
  staffedStations,
  defaultSlotMinutes,
  onCreated,
}: RosterSetupProps) {
  const [selected, setSelected] = useState<string[]>(
    staffedStations.map((s) => s.toUpperCase())
  );
  const [slotMinutes, setSlotMinutes] = useState<number>(
    [15, 30].includes(defaultSlotMinutes) ? defaultSlotMinutes : 30
  );
  const [datahubStations, setDatahubStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [customStation, setCustomStation] = useState("");
  const [creating, setCreating] = useState(false);

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
        // Datahub optional – Freitext bleibt möglich
      } finally {
        if (!cancelled) setLoadingStations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventAirports]);

  const toggle = (callsign: string) => {
    const cs = callsign.toUpperCase();
    setSelected((prev) =>
      prev.includes(cs) ? prev.filter((s) => s !== cs) : [...prev, cs]
    );
  };

  const addCustom = () => {
    const cs = customStation.trim().toUpperCase();
    if (!cs) return;
    if (selected.includes(cs)) {
      toast.info(`${cs} ist bereits in der Liste`);
      return;
    }
    setSelected((prev) => [...prev, cs]);
    setCustomStation("");
  };

  const sortedSelected = useMemo(() => {
    const rank = (cs: string) => {
      const g = extractStationGroup(cs);
      return g ? STATION_GROUP_ORDER.indexOf(g) : 99;
    };
    return [...selected].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [selected]);

  const create = async () => {
    if (sortedSelected.length === 0) {
      toast.error("Bitte mindestens eine Station auswählen");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotMinutes, stations: sortedSelected }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Fehler beim Anlegen des Rosters");
      }
      toast.success("Roster angelegt – los geht die Planung!");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stationen bestätigen</CardTitle>
          <CardDescription>
            Prüfe die zu besetzenden Stationen, bevor der Besetzungsplan erstellt wird.
            Die im Event hinterlegten Stationen sind vorausgewählt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Ausgewählte Stationen */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Ausgewählte Stationen ({sortedSelected.length})
            </Label>
            {sortedSelected.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Noch keine Stationen ausgewählt.</AlertDescription>
              </Alert>
            ) : (
              <SelectedStationList
                selected={sortedSelected}
                eventAirports={eventAirports}
                onRemove={toggle}
              />
            )}
          </div>

          {/* Vorschläge aus dem Datahub */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Stationen wählen ({eventAirports.join(", ") || "kein Airport"})
            </Label>
            {loadingStations ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lade Stationen…
              </div>
            ) : datahubStations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Stationen gefunden.</p>
            ) : (
              <StationPicker
                selected={selected}
                available={datahubStations}
                eventAirports={eventAirports}
                onToggle={toggle}
              />
            )}
          </div>

          {/* Freitext */}
          <div className="flex gap-2">
            <Input
              placeholder="Station manuell hinzufügen (z. B. EDMM_S_CTR)"
              value={customStation}
              onChange={(e) => setCustomStation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button variant="outline" onClick={addCustom}>
              <Plus className="h-4 w-4 mr-1" /> Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zeitraster</CardTitle>
          <CardDescription>
            In welchem Raster sollen die Schichten geplant werden?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[15, 30].map((m) => (
              <button
                key={m}
                onClick={() => setSlotMinutes(m)}
                className={`border rounded-lg p-4 text-left transition-colors ${
                  slotMinutes === m
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{m} Minuten</span>
                  {slotMinutes === m && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {m === 15
                    ? "Feinere Planung, mehr Spalten"
                    : "Übersichtlicher, gröbere Blöcke"}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={create} disabled={creating}>
        {creating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird angelegt…
          </>
        ) : (
          <>Roster erstellen ({sortedSelected.length} Stationen, {slotMinutes}-min-Raster)</>
        )}
      </Button>
    </div>
  );
}
