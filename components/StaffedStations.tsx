import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { stationOverrides } from "@/lib/stations/stationOverrides";

type StaffedStationsProps = {
  callsigns: string[];
};

export default function StaffedStations({ callsigns }: StaffedStationsProps) {
  const grouped: Record<string, string[]> = {
    GND: [],
    TWR: [],
    APP: [],
    CTR: [],
    Sonstiges: [],
  };

  callsigns.forEach((cs) => {
    // Check ob Override existiert
    const overrideGroup = stationOverrides[cs];
    if (overrideGroup.group) {
      grouped[overrideGroup.group].push(cs);
      return;
    }

    // Standard-Gruppierung anhand des Callsigns
    if (cs.includes("_GND") || cs.includes("_DEL")) grouped.GND.push(cs);
    else if (cs.includes("_TWR")) grouped.TWR.push(cs);
    else if (cs.includes("_APP")) grouped.APP.push(cs);
    else if (cs.includes("_CTR")) grouped.CTR.push(cs);
    else grouped.Sonstiges.push(cs);
  });

  const order: (keyof typeof grouped)[] = ["GND", "TWR", "APP", "CTR", "Sonstiges"];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {order.map((group) => {
        const stations = grouped[group];
        if (stations.length === 0) return null;

        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{group}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {stations.map((cs) => (
                <div
                  key={cs}
                  className="rounded-md border p-2 text-sm font-medium bg-muted"
                >
                  {cs}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
