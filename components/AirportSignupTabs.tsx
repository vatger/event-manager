"use client";

import { useState, useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SignupTableEntry } from "@/lib/cache/types";
import { Plane } from "lucide-react";

export interface AirportSignupTabsRef {
  reload: () => void;
}

interface AirportSignupTabsProps {
  airports: string[];
  eventId: number;
  renderSignupsTable: (filteredSignups: SignupTableEntry[], airport?: string) => React.ReactNode;
}

const AirportSignupTabs = forwardRef<AirportSignupTabsRef, AirportSignupTabsProps>(function AirportSignupTabs(
  { 
    airports, 
    eventId,
    renderSignupsTable 
  }: AirportSignupTabsProps,
  ref
) {
  const [activeTab, setActiveTab] = useState<string>(
    airports.length > 1 ? "all" : airports[0]
  );
  const [signups, setSignups] = useState<SignupTableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Load signups
  const loadSignups = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const url = forceRefresh 
        ? `/api/events/${eventId}/signup/full?refresh=true`
        : `/api/events/${eventId}/signup/full`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fehler beim Laden der Signups");

      const data = await res.json();
      if (!Array.isArray(data.signups)) throw new Error("Invalid response format");
      setSignups(data.signups);
      
      if (data.lastUpdate) {
        setLastUpdate(data.lastUpdate);
      }
    } catch (err) {
      console.error("SignupTable load error:", err);
      setSignups([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Expose reload to parent
  useImperativeHandle(ref, () => ({
    reload: () => {
      void loadSignups(true);
    },
  }), [loadSignups]);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    try {
      if (lastUpdate === 0) return;
      
      const res = await fetch(`/api/events/${eventId}/signup/full`);
      if (!res.ok) return;

      const data = await res.json();
      
      if (data.lastUpdate && data.lastUpdate > lastUpdate) {
        console.log(`[AirportSignupTabs] Detected update, reloading...`);
        await loadSignups(true);
      }
    } catch (err) {
      console.error("Update check error:", err);
    }
  }, [eventId, lastUpdate, loadSignups]);

  useEffect(() => {
    loadSignups();
  }, [loadSignups]);

  // Polling for updates
  useEffect(() => {
    if (loading) return;
    
    const pollInterval = setInterval(() => {
      checkForUpdates();
    }, 10000);
    
    return () => clearInterval(pollInterval);
  }, [loading, checkForUpdates]);

  const airportStats = useMemo(() => {
    const stats: Record<
      string,
      { total: number; groups: Record<string, number> }
    > = {};
  
    // Initialisieren
    airports.forEach(airport => {
      stats[airport] = { total: 0, groups: {} };
    });
  
    signups.forEach(signup => {
      if (signup.deletedAt) return;
  
      const airportEndorsements = signup.airportEndorsements;
      if (!airportEndorsements) return;
  
      Object.entries(airportEndorsements).forEach(
        ([airport, endorsement]) => {
          if (!stats[airport]) return;
  
          const group = endorsement.group || "UNSPEC";
  
          stats[airport].total += 1;
          stats[airport].groups[group] =
            (stats[airport].groups[group] || 0) + 1;
        }
      );
    });
  
    return stats;
  }, [signups, airports]);
  

  console.log("Signup", signups)
  console.log("Airport Stats:", airportStats);
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
      <div className="w-full overflow-x-auto">
        <TabsList className="inline-grid w-full min-w-max auto-cols-fr gap-1" style={{ gridTemplateColumns: `repeat(${airports.length + 1}, minmax(120px, 1fr))` }}>
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
      </div>

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
});

export default AirportSignupTabs;
