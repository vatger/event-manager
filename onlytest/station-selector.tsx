"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, X, Check, RadioTower, MapPin, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Typdefinitionen
interface Airport {
  icao: string;
  name: string;
}

interface ATCStation {
  logon: string;
  name: string;
  frequency: string;
  type: 'GND' | 'TWR' | 'APP' | 'CTR' | 'OTHER';
  airportIcao?: string;
}

interface Event {
  id: string;
  name: string;
  airports: Airport[];
}

interface ATCStationsWidgetProps {
  event: Event;
  selectedStations: ATCStation[];
  onStationsChange: (stations: ATCStation[]) => void;
}

// Mock-Daten (werden später durch Datahub-API ersetzt)
const MOCK_STATIONS: ATCStation[] = [
  { logon: "EDGG_CTR", name: "Langen Radar", frequency: "132.620", type: "CTR", airportIcao: "EDGG" },
  { logon: "EDGG_N_CTR", name: "Langen Nord Radar", frequency: "133.220", type: "CTR", airportIcao: "EDGG" },
  { logon: "EDDS_APP", name: "Stuttgart Approach", frequency: "119.620", type: "APP", airportIcao: "EDDS" },
  { logon: "EDDS_TWR", name: "Stuttgart Tower", frequency: "118.620", type: "TWR", airportIcao: "EDDS" },
  { logon: "EDDS_GND", name: "Stuttgart Ground", frequency: "121.920", type: "GND", airportIcao: "EDDS" },
  { logon: "EDDH_APP", name: "Hamburg Approach", frequency: "119.720", type: "APP", airportIcao: "EDDH" },
  { logon: "EDDH_TWR", name: "Hamburg Tower", frequency: "118.320", type: "TWR", airportIcao: "EDDH" },
  { logon: "EDDH_GND", name: "Hamburg Ground", frequency: "121.820", type: "GND", airportIcao: "EDDH" },
  { logon: "EDDL_APP", name: "Düsseldorf Approach", frequency: "119.220", type: "APP", airportIcao: "EDDL" },
  { logon: "EDDL_TWR", name: "Düsseldorf Tower", frequency: "118.520", type: "TWR", airportIcao: "EDDL" },
  { logon: "EDDL_GND", name: "Düsseldorf Ground", frequency: "121.720", type: "GND", airportIcao: "EDDL" },
];

export default function ATCStationsWidget({ 
  event, 
  selectedStations, 
  onStationsChange 
}: ATCStationsWidgetProps) {
  const [allStations, setAllStations] = useState<ATCStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [customStationLogon, setCustomStationLogon] = useState("");

  // Daten vom VATGER Datahub laden
  useEffect(() => {
    const fetchStations = async () => {
      setIsLoading(true);
      try {
        // Hier würde der eigentliche API-Call zum VATGER Datahub stattfinden
        // Für dieses Beispiel verwenden wir Mock-Daten
        setTimeout(() => {
          setAllStations(MOCK_STATIONS);
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error("Fehler beim Laden der ATC-Stationen:", error);
        setIsLoading(false);
      }
    };

    fetchStations();
  }, [event.airports]);

  // Stationen nach Event-Airports filtern
  const eventStations = useMemo(() => {
    const eventAirportIcaos = event.airports.map(ap => ap.icao);
    return allStations.filter(station => 
      station.airportIcao && eventAirportIcaos.includes(station.airportIcao)
    );
  }, [allStations, event.airports]);

  // Stationen nach Typ gruppieren
  const stationsByType = useMemo(() => {
    const grouped: Record<string, ATCStation[]> = {
      GND: [],
      TWR: [],
      APP: [],
      CTR: [],
      OTHER: []
    };

    eventStations.forEach(station => {
      if (grouped[station.type]) {
        grouped[station.type].push(station);
      } else {
        grouped.OTHER.push(station);
      }
    });

    return grouped;
  }, [eventStations]);

  // Gefilterte Stationen für die Suche
  const filteredStations = useMemo(() => {
    if (!searchQuery) return eventStations;
    
    const query = searchQuery.toLowerCase();
    return eventStations.filter(station => 
      station.logon.toLowerCase().includes(query) ||
      station.name.toLowerCase().includes(query) ||
      station.frequency.includes(query) ||
      (station.airportIcao && station.airportIcao.toLowerCase().includes(query))
    );
  }, [eventStations, searchQuery]);

  // Station auswählen
  const toggleStation = (station: ATCStation) => {
    const isSelected = selectedStations.some(s => s.logon === station.logon);
    
    if (isSelected) {
      onStationsChange(selectedStations.filter(s => s.logon !== station.logon));
    } else {
      onStationsChange([...selectedStations, station]);
    }
  };

  // Benutzerdefinierte Station hinzufügen
  const addCustomStation = () => {
    if (!customStationLogon.trim()) return;
    
    const newStation: ATCStation = {
      logon: customStationLogon.trim(),
      name: `Benutzerdefinierte Station (${customStationLogon})`,
      frequency: "N/A",
      type: "OTHER"
    };
    
    onStationsChange([...selectedStations, newStation]);
    setCustomStationLogon("");
  };

  // Icon für Stationstyp
  const getStationIcon = (type: string) => {
    switch (type) {
      case "GND": return <Waves className="h-4 w-4" />;
      case "TWR": return <RadioTower className="h-4 w-4" />;
      case "APP": return <Waves className="h-4 w-4" />;
      case "CTR": return <MapPin className="h-4 w-4" />;
      default: return <RadioTower className="h-4 w-4" />;
    }
  };

  // Badge-Varianten für Stationstypen
  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "GND": return "secondary";
      case "TWR": return "default";
      case "APP": return "outline";
      case "CTR": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>ATC Stationen auswählen</span>
          <Badge variant="outline">{selectedStations.length} ausgewählt</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Ausgewählte Stationen anzeigen */}
        {selectedStations.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Ausgewählte Stationen</h3>
            <div className="flex flex-wrap gap-2">
              {selectedStations.map(station => (
                <Badge 
                  key={station.logon} 
                  variant={getBadgeVariant(station.type)}
                  className="flex items-center gap-1 py-1"
                >
                  {getStationIcon(station.type)}
                  {station.logon}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 rounded-full"
                    onClick={() => toggleStation(station)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suchfeld */}
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Station suchen (Logon, Name, Frequenz)..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Benutzerdefinierte Station hinzufügen */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mb-4 w-full">
              <Plus className="h-4 w-4 mr-2" />
              Station manuell hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Station manuell hinzufügen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Geben Sie den Logon-Namen der Station ein, die Sie hinzufügen möchten.
              </p>
              <Input
                placeholder="Z.B.: EDDF_CTR"
                value={customStationLogon}
                onChange={(e) => setCustomStationLogon(e.target.value)}
              />
              <Button onClick={addCustomStation} className="w-full">
                Station hinzufügen
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stationsauswahl */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="GND">GND</TabsTrigger>
              <TabsTrigger value="TWR">TWR</TabsTrigger>
              <TabsTrigger value="APP">APP</TabsTrigger>
              <TabsTrigger value="CTR">CTR</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-64">
              {/* Alle Stationen anzeigen */}
              <TabsContent value="all" className="space-y-2 m-0">
                {filteredStations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Keine Stationen gefunden
                  </p>
                ) : (
                  filteredStations.map(station => {
                    const isSelected = selectedStations.some(s => s.logon === station.logon);
                    return (
                      <div
                        key={station.logon}
                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                          isSelected 
                            ? "bg-primary/10 border-primary" 
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleStation(station)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${
                            isSelected ? "bg-primary" : "bg-muted"
                          }`}>
                            {getStationIcon(station.type)}
                          </div>
                          <div>
                            <div className="font-medium">{station.logon}</div>
                            <div className="text-sm text-muted-foreground">
                              {station.name} • {station.frequency}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="h-5 w-5 text-primary" />}
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* Nach Typ gefilterte Stationen anzeigen */}
              {(["GND", "TWR", "APP", "CTR"] as const).map(type => (
                <TabsContent key={type} value={type} className="space-y-2 m-0">
                  {stationsByType[type].length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Keine {type}-Stationen verfügbar
                    </p>
                  ) : (
                    stationsByType[type].map(station => {
                      const isSelected = selectedStations.some(s => s.logon === station.logon);
                      return (
                        <div
                          key={station.logon}
                          className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                            isSelected 
                              ? "bg-primary/10 border-primary" 
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleStation(station)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md ${
                              isSelected ? "bg-primary" : "bg-muted"
                            }`}>
                              {getStationIcon(station.type)}
                            </div>
                            <div>
                              <div className="font-medium">{station.logon}</div>
                              <div className="text-sm text-muted-foreground">
                                {station.name} • {station.frequency}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="h-5 w-5 text-primary" />}
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        )}

        {/* Info-Text */}
        <p className="text-xs text-muted-foreground mt-4">
          Daten werden vom VATGER Datahub bereitgestellt. 
          Nicht gefundene Stationen können manuell hinzugefügt werden.
        </p>
      </CardContent>
    </Card>
  );
}