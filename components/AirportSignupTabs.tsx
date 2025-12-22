"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignupTableEntry } from "@/lib/cache/types";
import { Plane } from "lucide-react";

interface AirportSignupTabsProps {
  airports: string[];
  eventId: number;
  renderSignupsTable: (filteredSignups: SignupTableEntry[], airport?: string) => React.ReactNode;
}

export default function AirportSignupTabs({ 
  airports, 
  eventId,
  renderSignupsTable 
}: AirportSignupTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(
    airports.length > 1 ? "all" : airports[0]
  );
  const [signups, setSignups] = useState<SignupTableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load signups
  const loadSignups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}/signup/full`);
      if (!res.ok) throw new Error("Fehler beim Laden der Signups");

      const data = await res.json();
      if (!Array.isArray(data.signups)) throw new Error("Invalid response format");
      setSignups(data.signups);
    } catch (err) {
      console.error("SignupTable load error:", err);
      setSignups([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadSignups();
  }, [loadSignups]);

  // Calculate statistics per airport
  const airportStats = useMemo(() => {
    const stats: Record<string, { total: number; groups: Record<string, number> }> = {};
    
    airports.forEach(airport => {
      stats[airport] = { total: 0, groups: {} };
    });

    signups.forEach(signup => {
      // Skip deleted signups
      if (signup.deletedAt) return;

      const selectedAirports = signup.selectedAirports || airports;
      const group = signup.endorsement?.group || "UNSPEC";

      selectedAirports.forEach(airport => {
        if (stats[airport]) {
          stats[airport].total++;
          stats[airport].groups[group] = (stats[airport].groups[group] || 0) + 1;
        }
      });
    });

    return stats;
  }, [signups, airports]);

  // Filter signups by airport
  const getSignupsForAirport = (airport: string) => {
    return signups.filter(signup => {
      const selectedAirports = signup.selectedAirports || airports;
      return selectedAirports.includes(airport);
    });
  };

  // Only show tabs if multiple airports
  if (airports.length === 1) {
    return <>{renderSignupsTable(signups, airports[0])}</>;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-32">
      <p className="text-muted-foreground">Lade Anmeldungen...</p>
    </div>;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${airports.length + 1}, 1fr)` }}>
        <TabsTrigger value="all" className="gap-2">
          <Plane className="h-4 w-4" />
          Alle Airports
          <Badge variant="secondary" className="ml-1">
            {signups.filter(s => !s.deletedAt).length}
          </Badge>
        </TabsTrigger>
        {airports.map(airport => (
          <TabsTrigger key={airport} value={airport} className="gap-2">
            {airport}
            <Badge variant="secondary" className="ml-1">
              {airportStats[airport]?.total || 0}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="all" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {airports.map(airport => (
            <div key={airport} className="p-3 border rounded-lg">
              <div className="text-sm font-medium text-muted-foreground">{airport}</div>
              <div className="text-2xl font-bold">{airportStats[airport]?.total || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {Object.entries(airportStats[airport]?.groups || {})
                  .map(([group, count]) => `${group}: ${count}`)
                  .join(" • ")}
              </div>
            </div>
          ))}
        </div>
        {renderSignupsTable(signups)}
      </TabsContent>

      {airports.map(airport => (
        <TabsContent key={airport} value={airport} className="space-y-4 mt-4">
          <div className="mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(airportStats[airport]?.groups || {})
                .sort((a, b) => {
                  const order = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4, UNSPEC: 999 };
                  return (order[a[0] as keyof typeof order] || 999) - (order[b[0] as keyof typeof order] || 999);
                })
                .map(([group, count]) => (
                  <div key={group} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm font-medium">{group}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
            </div>
          </div>
          {renderSignupsTable(getSignupsForAirport(airport), airport)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
