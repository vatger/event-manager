// components/admin/StationSelector.tsx
"use client";

import { useState } from "react";
import { stationsConfig, StationGroup } from "@/data/station_configs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, Search } from "lucide-react";

interface StationSelectorProps {
  airport: string;
  selectedStations: string[];
  onStationsChange: (stations: string[]) => void;
  disabled?: boolean;
}

const GROUPS: StationGroup[] = ["GND", "TWR", "APP", "CTR"];

export default function StationSelector({ 
  airport, 
  selectedStations, 
  onStationsChange, 
  disabled = false 
}: StationSelectorProps) {
  const [customStation, setCustomStation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStations = GROUPS.map((group) => ({
    group,
    stations: stationsConfig.filter(
      (s) => 
        s.group === group && 
        (!s.airport || s.airport === airport.toUpperCase()) &&
        s.callsign.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(({ stations }) => stations.length > 0);

  const toggleStation = (callsign: string) => {
    const isSelected = selectedStations.includes(callsign);
    if (isSelected) {
      onStationsChange(selectedStations.filter(s => s !== callsign));
    } else {
      onStationsChange([...selectedStations, callsign]);
    }
  };

  const addCustomStation = () => {
    if (customStation.trim() && !selectedStations.includes(customStation.toUpperCase())) {
      onStationsChange([...selectedStations, customStation.toUpperCase()]);
      setCustomStation("");
    }
  };

  const removeStation = (station: string) => {
    onStationsChange(selectedStations.filter(s => s !== station));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomStation();
    }
  };

  return (
    <div className="space-y-4">
      {/* Ausgewählte Stationen */}
      {selectedStations.length > 0 && (
        <div className="space-y-2">
          <Label>Ausgewählte Stationen ({selectedStations.length})</Label>
          <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/20 min-h-12">
            {selectedStations.map((station) => (
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

      {/* Benutzerdefinierte Station hinzufügen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Benutzerdefinierte Station</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              onClick={addCustomStation}
              disabled={!customStation.trim() || disabled}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vordefinierte Stationen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Vordefinierte Stationen für {airport.toUpperCase()}</CardTitle>
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

          {/* Stations-Gruppen */}
          <Tabs defaultValue={GROUPS[0]} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              {GROUPS.map((group) => (
                <TabsTrigger 
                  key={group} 
                  value={group}
                  disabled={filteredStations.find(g => g.group === group)?.stations.length === 0}
                >
                  {group}
                </TabsTrigger>
              ))}
            </TabsList>

            {GROUPS.map((group) => {
              const groupStations = filteredStations.find(g => g.group === group)?.stations || [];
              
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
                            ${selectedStations.includes(station.callsign) 
                              ? 'border-green-500 border-2' 
                              : 'bg-background'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                          `}
                        >
                          <span className="font-medium">{station.callsign}</span>
                          <Badge variant="outline" className={`ml-2 ${selectedStations.includes(station.callsign) ? 'bg-green-500 text-white border-green-500' : ''}`}>
                            {station.group}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'Keine Stationen gefunden' : 'Keine Stationen verfügbar'}
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
              onClick={() => {
                const allStations = filteredStations.flatMap(g => g.stations.map(s => s.callsign));
                onStationsChange(allStations);
              }}
              disabled={disabled}
            >
              Alle auswählen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}