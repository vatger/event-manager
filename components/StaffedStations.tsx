"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractStationGroup, STATION_GROUP_ORDER } from "@/lib/weeklys/stationUtils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";

type StaffedStationsProps = {
  callsigns: string[];
};

/** Callsigns tragen den Platz als Präfix: EDDM_TWR → EDDM, EDMM_WLD_CTR → EDMM */
const airportOf = (callsign: string) =>
  /^[A-Z]{4}/i.test(callsign) ? callsign.slice(0, 4).toUpperCase() : "Weitere";

const groupRank = (callsign: string) => {
  const g = extractStationGroup(callsign);
  return g ? STATION_GROUP_ORDER.indexOf(g) : 99;
};

/** Nach Ebene sortieren (DEL → CTR), bei Gleichstand alphabetisch */
function byGroupThenName(a: string, b: string): number {
  return groupRank(a) - groupRank(b) || a.localeCompare(b);
}

/**
 * Die zu besetzenden Stationen eines Events.
 *
 * Gegliedert wie die Stationsauswahl im Besetzungsplan: zuerst nach Platz,
 * innerhalb eines Platzes von DEL nach CTR. Eine gemeinsame Liste taugt bei
 * Events über mehrere Plätze nicht – dort sucht man die Stationen eines
 * bestimmten Platzes, und die lägen sonst über die ganze Aufzählung verstreut.
 * Die Farbe der Plakette zeigt die Ebene, wie überall sonst im System.
 */
export default function StaffedStations({ callsigns }: StaffedStationsProps) {
  const groups = useMemo(() => {
    const byAirport = new Map<string, Set<string>>();
    for (const cs of callsigns ?? []) {
      if (!cs) continue;
      const upper = cs.toUpperCase();
      const airport = airportOf(upper);
      const set = byAirport.get(airport);
      if (set) set.add(upper);
      else byAirport.set(airport, new Set([upper]));
    }

    return [...byAirport.entries()]
      .map(([airport, set]) => ({ airport, stations: [...set].sort(byGroupThenName) }))
      .sort((a, b) => a.airport.localeCompare(b.airport));
  }, [callsigns]);

  const total = useMemo(
    () => groups.reduce((sum, g) => sum + g.stations.length, 0),
    [groups]
  );

  if (groups.length === 0) return null;

  const stationBadges = (stations: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {stations.map((station) => (
        <span
          key={station}
          className={cn(
            "inline-flex items-center rounded-md px-2 py-1 font-mono text-xs font-semibold tracking-wide",
            getBadgeClassForEndorsement(extractStationGroup(station))
          )}
        >
          {station}
        </span>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Radio className="h-4 w-4 text-muted-foreground" />
          Zu besetzende Stationen
          <Badge variant="secondary" className="font-semibold">
            {total}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Ein einzelner Platz braucht keine Gliederung – dort gibt es nichts zu suchen. */}
        {groups.length === 1 ? (
          stationBadges(groups[0].stations)
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <div
                key={group.airport}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
              >
                <div className="flex shrink-0 items-center gap-2 sm:w-24 sm:pt-0.5">
                  <span className="font-mono text-sm font-bold tracking-wide text-foreground">
                    {group.airport}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group.stations.length}
                  </span>
                </div>
                <div className="min-w-0 flex-1">{stationBadges(group.stations)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
