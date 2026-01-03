"use client";

import { useState, useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SignupTableEntry } from "@/lib/cache/types";
import { Plane } from "lucide-react";
import { parseOptOutAirports } from "@/lib/multiAirport";

export interface AirportSignupTabsRef {
  reload: () => void;
}

interface AirportSignupTabsProps {
  airports: string[];
  eventId: number;
  renderSignupsTable: (filteredSignups: SignupTableEntry[], airport?: string) => React.ReactNode;
  onAirportChange?: (airport: string | undefined) => void;
}

const AirportSignupTabs = forwardRef<AirportSignupTabsRef, AirportSignupTabsProps>(function AirportSignupTabs(
  { 
    airports, 
    eventId,
    renderSignupsTable,
    onAirportChange
  }: AirportSignupTabsProps,
  ref
) {
  const [activeTab, setActiveTab] = useState<string>(
    airports.length > 1 ? "all" : airports[0]
  );
  const [signups, setSignups] = useState<SignupTableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (onAirportChange) {
      onAirportChange(value === "all" ? undefined : value);
    }
  };

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

    // Init
    airports.forEach(airport => {
      stats[airport] = { total: 0, groups: {} };
    });

    signups.forEach(signup => {
      if (signup.deletedAt) return;

      const optedOut = parseOptOutAirports(signup.remarks || "");
      const endorsements = signup.airportEndorsements || {};

      Object.entries(endorsements).forEach(([airport, endorsement]) => {
        if (!stats[airport]) return;
        if (!endorsement || !endorsement.group) return; // only count if can staff
        if (optedOut.includes(airport)) return; // skip opted-out for counts

        const group = endorsement.group || "UNSPEC";
        stats[airport].total += 1;
        stats[airport].groups[group] = (stats[airport].groups[group] || 0) + 1;
      });
    });

    return stats;
  }, [signups, airports]);
  

  console.log("Signup", signups)
  console.log("Airport Stats:", airportStats);
  // Filter signups by airport
  const getSignupsForAirport = (airport: string) => {
    // Include users who can theoretically staff the airport (have endorsement),
    // even if they opted out via !ICAO; sort opted-out to the end
    const list = signups.filter(signup => {
      const endorsement = signup.airportEndorsements?.[airport];
      return !!endorsement?.group; // can staff this airport
    });

    return list.sort((a, b) => {
      const aOpted = parseOptOutAirports(a.remarks || "").includes(airport) ? 1 : 0;
      const bOpted = parseOptOutAirports(b.remarks || "").includes(airport) ? 1 : 0;
      if (aOpted !== bOpted) return aOpted - bOpted; // non-opted first
      const an = a.user?.name || "";
      const bn = b.user?.name || "";
      return an.localeCompare(bn);
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
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {airports.map(airport => {
            const stats = airportStats[airport] || { total: 0, groups: {} };
            const groups = Object.entries(stats.groups);
            const maxCount = Math.max(...airports.map(a => airportStats[a]?.total || 0), 1);
            const percentage = (stats.total / maxCount) * 100;
            
            return (
              <div 
                key={airport} 
                className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-sm transition-all duration-200"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {airport}
                  </div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-400">
                    {stats.total}
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                
                {/* Group Details */}
                {groups.length > 0 && (
                  <div className="space-y-1.5">
                    {groups.map(([group, count]) => (
                      <div key={group} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{group}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {renderSignupsTable(signups)}
      </TabsContent>

      {airports.map(airport => {
        const stats = airportStats[airport];
        const groups = Object.entries(stats?.groups || {})
          .sort((a, b) => {
            const order = { DEL: 0, GND: 1, TWR: 2, APP: 3, CTR: 4, UNSPEC: 999 };
            return (order[a[0] as keyof typeof order] || 999) - (order[b[0] as keyof typeof order] || 999);
          });
        
        const total = stats?.total || 0;
        
        return (
          <TabsContent key={airport} value={airport} className="space-y-6 mt-6">
            {/* Stats Cards Grid */}
            <div className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {groups.map(([group, count]) => {
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  
                  return (
                    <div 
                      key={group} 
                      className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-sm transition-all duration-200"
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {group}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-blue-900 dark:text-blue-400">
                          {count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Signups Table */}
            {renderSignupsTable(getSignupsForAirport(airport), airport)}
          </TabsContent>
        );
      })}
    </Tabs>
  );
});

export default AirportSignupTabs;
