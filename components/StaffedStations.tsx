import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StationGroup } from "@/lib/stations/types";
import { stationOverrides } from "@/lib/stations/stationOverrides";

type StaffedStationsProps = {
  callsigns: string[];
};

export default function StaffedStations({ callsigns }: StaffedStationsProps) {
  const groupedStations = useMemo(() => {
    const result: Record<StationGroup, string[]> = {
      DEL: [],
      GND: [],
      TWR: [],
      APP: [],
      CTR: [],
      Sonstiges: [],
    };

    for (const cs of callsigns) {
      // Override prüfen
      const override = stationOverrides[cs];
      if (override?.group) {
        result[override.group].push(cs);
        continue;
      }

      // Fallback anhand des Callsigns
      if (cs.includes("_DEL") || cs.includes("_GND")) {
        result["GND"].push(cs);
      } else if (cs.includes("_TWR")) {
        result["TWR"].push(cs);
      } else if (cs.includes("_APP")) {
        result["APP"].push(cs);
      } else if (cs.includes("_CTR")) {
        result["CTR"].push(cs);
      } else {
        result["Sonstiges"].push(cs);
      }
    }

    // Spezielle Sortierung für GND: _DEL zuerst, dann alphabetisch
    (Object.keys(result) as StationGroup[]).forEach((key) => {
      if (key === "GND") {
        // _DEL Callsigns zuerst, dann der Rest alphabetisch
        result[key].sort((a, b) => {
          const aIsDel = a.includes("_DEL");
          const bIsDel = b.includes("_DEL");
          
          if (aIsDel && !bIsDel) return -1;
          if (!aIsDel && bIsDel) return 1;
          
          // Beide sind _DEL oder beide sind nicht _DEL → alphabetisch sortieren
          return a.localeCompare(b);
        });
      } else {
        // Andere Gruppen einfach alphabetisch sortieren
        result[key].sort((a, b) => a.localeCompare(b));
      }
    });

    // In Array für Tabs umwandeln und leere Gruppen filtern
    return Object.entries(result)
      .filter(([_, stations]) => stations.length > 0)
      .sort(([groupA], [groupB]) => {
        const order: StationGroup[] = ["GND", "TWR", "APP", "CTR", "Sonstiges"];
        return order.indexOf(groupA as StationGroup) - order.indexOf(groupB as StationGroup);
      });
  }, [callsigns]);

  // Standard-Tab Wert (erste nicht-leere Gruppe oder "GND")
  const defaultTab = groupedStations[0]?.[0] as string || "GND";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zu besetzende Stationen</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex flex-wrap gap-2 bg-muted/50 p-1 rounded-lg w-full">
            {groupedStations.map(([area, stations]) => (
              <TabsTrigger
                key={area as string}
                value={area as string}
                className="rounded-md px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition"
              >
                {area as string}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({(stations as string[]).length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {groupedStations.map(([area, stations]) => (
            <TabsContent key={area as string} value={area as string}>
              <div className="flex flex-wrap gap-2">
                {(stations as string[]).map((station) => (
                  <Badge 
                    key={station} 
                    variant="secondary" 
                    className="px-2.5 py-1 rounded-md"
                  >
                    {station}
                  </Badge>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}