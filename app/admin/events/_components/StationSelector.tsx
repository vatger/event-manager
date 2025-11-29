"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Search } from "lucide-react";
import { Station, StationGroup } from "@/lib/stations/types";
import { fetchAllStations, fetchStationsByAirport } from "@/lib/stations/fetchStations";

interface StationSelectorProps {
  airports: string[];
  selectedStations: string[];
  onStationsChange: (stations: string[]) => void;
  disabled?: boolean;
}

const GROUPS: StationGroup[] = ["GND", "TWR", "APP", "CTR"];

export default function StationSelector({ 
  airports, 
  selectedStations, 
  onStationsChange, 
  disabled = false 
}: StationSelectorProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [customStation, setCustomStation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [activeAirport, setActiveAirport] = useState<string>(airports[0] || "");
  
  // Update active airport when airports change
  useEffect(() => {
    if (airports.length > 0 && !airports.includes(activeAirport)) {
      setActiveAirport(airports[0]);
    }
  }, [airports, activeAirport]);

  // Stationen dynamisch laden (vom Datahub)
  useEffect(() => {
    const loadStations = async () => {
      try {
        const all = await fetchAllStations();
        // For multi-airport, fetch stations for all airports
        const stationsPromises = airports.map(airport => fetchStationsByAirport(airport));
        const allAirportStations = await Promise.all(stationsPromises);
        // Flatten and deduplicate using Map for O(n) complexity
        const combinedStations = allAirportStations.flat();
        const uniqueStations = Array.from(
          new Map(combinedStations.map(s => [s.callsign, s])).values()
        );
        setStations(uniqueStations);
        setAllStations(all);
      } catch (err) {
        console.error("Fehler beim Laden der Stationen:", err);
      }
    };
    if (airports.length > 0) {
      loadStations();
    }
  }, [airports]);

  // Sortierte Stationen nach Gruppe
  const sortedStations = useMemo(() => {
    return [...stations].sort((a, b) => {
      const groupOrder = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
      if (groupOrder !== 0) return groupOrder;
      return a.callsign.localeCompare(b.callsign);
    });
  }, [stations]);

  // Gefilterte Stationen (für Tabs) - filter by active airport
  const filteredStations = GROUPS.map((group) => ({
    group,
    stations: sortedStations.filter(
      (s) =>
        s.group === group &&
        (!s.airport || s.airport === activeAirport.toUpperCase()) &&
        s.callsign.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(({ stations }) => stations.length > 0);

  // Vorschläge für benutzerdefinierte Eingabe
  useEffect(() => {
    if (!customStation) {
      setSuggestions([]);
      return;
    }
    const query = customStation.toLowerCase();
    const matches = allStations
      .filter((s) => s.callsign.toLowerCase().includes(query))
      .slice(0, 8)
      .map((s) => s.callsign);
    setSuggestions(matches);
  }, [customStation, allStations]);

  // Sortierte Anzeige der ausgewählten Stationen
  const orderedSelectedStations = useMemo(() => {
    return selectedStations.sort((a, b) => {
      const stationA = sortedStations.find((s) => s.callsign === a);
      const stationB = sortedStations.find((s) => s.callsign === b);

      if (!stationA && !stationB) return a.localeCompare(b);
      if (!stationA) return 1;
      if (!stationB) return -1;
      return sortedStations.indexOf(stationA) - sortedStations.indexOf(stationB);
    });
  }, [selectedStations, sortedStations]);

  const toggleStation = (callsign: string) => {
    const isSelected = selectedStations.includes(callsign);
    if (isSelected) {
      onStationsChange(selectedStations.filter((s) => s !== callsign));
    } else {
      onStationsChange([...selectedStations, callsign]);
    }
  };

  const addCustomStation = (value?: string) => {
    const newStation = (value || customStation).trim().toUpperCase();
    if (newStation && !selectedStations.includes(newStation)) {
      onStationsChange([...selectedStations, newStation]);
    }
    setCustomStation("");
    setSuggestions([]);
  };

  const removeStation = (station: string) => {
    onStationsChange(selectedStations.filter((s) => s !== station));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomStation();
    }
  };

  const selectAllStations = () => {
    const allStationsForAirport = filteredStations.flatMap((g) => g.stations.map((s) => s.callsign));
    // Merge with existing selected stations
    const merged = [...new Set([...selectedStations, ...allStationsForAirport])];
    onStationsChange(merged);
  };

  return (
    <div className="space-y-4">
      {/* Ausgewählte Stationen */}
      {selectedStations.length > 0 && (
        <div className="space-y-2">
          <Label>Ausgewählte Stationen ({selectedStations.length})</Label>
          <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/20 min-h-12">
            {orderedSelectedStations.map((station) => (
              <Badge
                key={station}
                variant="secondary"
                className="px-3 py-1 text-sm flex items-center gap-1"
              >
                {station}
                <button
                  type="button"
                  onClick={() => removeStation(station)}
                  disabled={disabled}
                  className="hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Benutzerdefinierte Station mit Vorschlägen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Benutzerdefinierte Station</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 relative">
          <div className="flex gap-2">
            <Input
              placeholder="Station Callsign (z.B. EDDF_TWR)"
              value={customStation}
              onChange={(e) => setCustomStation(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => addCustomStation()}
              disabled={!customStation.trim() || disabled}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Dropdown Vorschläge */}
          {suggestions.length > 0 && (
            <div className="absolute z-10 bg-background border rounded-md shadow-md mt-1 w-full max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <div
                  key={s}
                  onClick={() => addCustomStation(s)}
                  className="p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm"
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Airport selector for multi-airport events */}
      {airports.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Airport auswählen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {airports.map((airport) => (
                <Button
                  key={airport}
                  type="button"
                  variant={activeAirport === airport ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveAirport(airport)}
                  disabled={disabled}
                >
                  {airport}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vordefinierte Stationen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Vordefinierte Stationen für {activeAirport.toUpperCase()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Suchfeld */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Station suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={disabled}
              className="pl-10"
            />
          </div>

          {/* Stationsgruppen */}
          <Tabs defaultValue={GROUPS[0]} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              {GROUPS.map((group) => (
                <TabsTrigger
                  key={group}
                  value={group}
                  disabled={
                    filteredStations.find((g) => g.group === group)?.stations.length === 0
                  }
                >
                  {group}
                </TabsTrigger>
              ))}
            </TabsList>

            {GROUPS.map((group) => {
              const groupStations =
                filteredStations.find((g) => g.group === group)?.stations || [];

              return (
                <TabsContent key={group} value={group} className="space-y-2">
                  {groupStations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                      {groupStations.map((station) => (
                        <button
                          key={station.callsign}
                          type="button"
                          onClick={() => toggleStation(station.callsign)}
                          disabled={disabled}
                          className={`
                            flex items-center justify-between p-3 border rounded-lg text-left
                            transition-all hover:bg-accent hover:text-accent-foreground
                            ${
                              selectedStations.includes(station.callsign)
                                ? "border-green-500 border-2"
                                : "bg-background"
                            }
                            ${
                              disabled
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            }
                          `}
                        >
                          <span className="font-medium">{station.callsign}</span>
                          <Badge
                            variant="outline"
                            className={`ml-2 ${
                              selectedStations.includes(station.callsign)
                                ? "bg-green-500 text-white border-green-500"
                                : ""
                            }`}
                          >
                            {station.group}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "Keine Stationen gefunden" : "Keine Stationen verfügbar"}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Schnellauswahl */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Schnellauswahl</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onStationsChange([])}
              disabled={disabled || selectedStations.length === 0}
            >
              Alle entfernen
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllStations}
              disabled={disabled}
            >
              Alle von {activeAirport} auswählen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}