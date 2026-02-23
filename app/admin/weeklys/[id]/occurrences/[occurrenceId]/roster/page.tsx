"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  ArrowLeft, 
  Users, 
  Check, 
  X, 
  Save,
  GripVertical,
  Clock,
  Calendar,
  MapPin,
  AlertCircle,
  History,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";
import { isTrainee } from "@/lib/weeklys/traineeUtils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { cn } from "@/lib/utils";

interface User {
  cid: number;
  name: string;
  rating: string;
}

interface UserHistory {
  userCID: number;
  previousOccurrences: Array<{
    occurrenceId: number;
    date: string;
    signedUp: boolean;
    assigned: boolean;
    station?: string;
  }>;
  stats: {
    totalOccurrencesChecked: number;
    totalSignups: number;
    totalAssigned: number;
    assignmentRate: number;
  };
}

interface StationExperience {
  totalMinutes: number;
  sessionCount: number;
  lastSession?: string;
}

interface ATCSessionStats {
  userCID: number;
  stationStats: {
    [station: string]: StationExperience;
  };
}

interface Signup {
  id: number;
  userCID: number;
  remarks: string | null;
  user: {
    cid: number;
    name: string;
    rating: number;
  } | null;
  endorsementGroup: string | null;
  restrictions: string[];
  history?: UserHistory | null;
  atcStats?: ATCSessionStats | null;
}

interface RosterEntry {
  id: number;
  occurrenceId: number;
  station: string;
  userCID: number;
  createdAt: string;
  updatedAt: string;
  user: User | null;
}

interface RosterEntry {
  id: number;
  station: string;
  userCID: number;
}

interface WeeklyConfig {
  id: number;
  name: string;
  requiresRoster: boolean;
  staffedStations: string[];
  startTime?: string;
  endTime?: string;
  airports?: string[];
}

interface Occurrence {
  id: number;
  date: string;
  rosterPublished: boolean;
}

interface RosterData {
  occurrence: Occurrence;
  config: WeeklyConfig;
  signups: Signup[];
  roster: RosterEntry[];
}

export default function RosterEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const configId = parseInt(params.id as string);
  const occurrenceId = parseInt(params.occurrenceId as string);

  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const [draggedUser, setDraggedUser] = useState<Signup | null>(null);
  const [s1TwrStations, setS1TwrStations] = useState<Set<string>>(new Set());

  // Fetch roster data
  useEffect(() => {
    if (!session) return;
    fetchData();
  }, [session, configId, occurrenceId]);

  const fetchData = async () => {
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      
      // Fetch station metadata to check for S1 TWR stations
      if (json.config?.staffedStations) {
        const stationsRes = await fetch(`/api/stations`);
        if (stationsRes.ok) {
          const stationsData = await stationsRes.json();
          const s1TwrSet = new Set<string>();
          
          for (const stationCallsign of json.config.staffedStations) {
            const station = stationsData.stations?.find(
              (s: any) => s.callsign.toUpperCase() === stationCallsign.toUpperCase()
            );
            if (station?.s1Twr === true) {
              s1TwrSet.add(stationCallsign.toUpperCase());
            }
          }
          
          setS1TwrStations(s1TwrSet);
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
      console.log("signups", data)
    }
  };

  const assignUser = async (station: string, userCID: number) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ station, userCID }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to assign");
      }

      toast.success("Benutzer zugewiesen");
      await fetchData();
    } catch (error: any) {
      console.error("Assign error:", error);
      toast.error(error.message || "Fehler beim Zuweisen");
    } finally {
      setSaving(false);
      setDraggedUser(null);
    }
  };

  const unassignUser = async (rosterId: number) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster/${rosterId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to unassign");
      }

      toast.success("Zuweisung entfernt");
      await fetchData();
    } catch (error: any) {
      console.error("Unassign error:", error);
      toast.error(error.message || "Fehler beim Entfernen");
    } finally {
      setSaving(false);
    }
  };

  const publishRoster = async (publish: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: publish }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to publish");
      }

      toast.success(publish ? "Roster veröffentlicht" : "Veröffentlichung zurückgezogen");
      await fetchData();
      setPublishDialog(false);
    } catch (error: any) {
      console.error("Publish error:", error);
      toast.error(error.message || "Fehler beim Veröffentlichen");
    } finally {
      setSaving(false);
    }
  };

  const getRatingBadge = (rating: number) => {
    const ratings = ["OBS", "S1", "S2", "S3", "C1", "C3", "I1", "I3", "SUP", "ADM"];
    return ratings[rating] || `R${rating}`;
  };

  const getAssignedUser = (station: string): Signup | null => {
    if (!data) return null;
    const rosterEntry = data.roster.find(r => r.station === station);
    if (!rosterEntry) return null;
    return data.signups.find(s => s.userCID === rosterEntry.userCID) || null;
  };

  const isUserAssigned = (userCID: number): boolean => {
    return data?.roster.some(r => r.userCID === userCID) || false;
  };

  const canUserStaffStation = (signup: Signup, station: string): boolean => {
    const stationGroup = extractStationGroup(station);
    if (!signup.endorsementGroup || !stationGroup) return false;
    
    // Check if this is an S1 TWR station
    const isS1Twr = s1TwrStations.has(station.toUpperCase());
    
    // Special case: S1 TWR stations can be staffed by GND-endorsed controllers
    if (stationGroup === 'TWR' && isS1Twr && signup.endorsementGroup === 'GND') {
      return true;
    }
    
    const groupOrder = ["DEL", "GND", "TWR", "APP", "CTR"];
    const userGroupIndex = groupOrder.indexOf(signup.endorsementGroup);
    const stationGroupIndex = groupOrder.indexOf(stationGroup);
    
    return userGroupIndex >= stationGroupIndex;
  };

  const handleDragStart = (signup: Signup) => {
    setDraggedUser(signup);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (station: string) => {
    if (draggedUser && canUserStaffStation(draggedUser, station)) {
      assignUser(station, draggedUser.userCID);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Alert variant="destructive" className="border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Fehler beim Laden der Daten</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3 md:gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/admin/weeklys/${configId}/occurrences`)}
              className="h-8 w-8 md:h-9 md:w-9 border-gray-300 dark:border-gray-700 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                Roster Editor
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 truncate">
                  {data.config.name}
                </p>
                <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
                <div className="flex items-center gap-1 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  <span>{format(new Date(data.occurrence.date), "dd.MM.yyyy", { locale: de })}</span>
                </div>
                {data.config.startTime && data.config.endTime && (
                  <>
                    <span className="hidden sm:inline text-gray-300 dark:text-gray-700">•</span>
                    <div className="flex items-center gap-1 text-xs md:text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      <span className="whitespace-nowrap">{data.config.startTime} - {data.config.endTime} UTC</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge 
              variant={data.occurrence.rosterPublished ? "default" : "secondary"}
              className={cn(
                "text-xs whitespace-nowrap",
                data.occurrence.rosterPublished && "bg-green-600"
              )}
            >
              {data.occurrence.rosterPublished ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <X className="h-3 w-3 mr-1" />
              )}
              <span className="hidden sm:inline">{data.occurrence.rosterPublished ? "Veröffentlicht" : "Nicht veröffentlicht"}</span>
              <span className="sm:hidden">{data.occurrence.rosterPublished ? "Publik" : "Privat"}</span>
            </Badge>
            <Button
              onClick={() => setPublishDialog(true)}
              disabled={saving}
              size="sm"
              className="bg-blue-900 hover:bg-blue-800 text-white h-8 md:h-9"
            >
              <Save className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
              <span className="hidden md:inline">{data.occurrence.rosterPublished ? "Zurückziehen" : "Veröffentlichen"}</span>
            </Button>
          </div>
        </div>

        {/* Main Grid - Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {/* Timeline - Stations */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="border-gray-200 dark:border-gray-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                  <CardTitle className="text-base lg:text-lg">Besetzungsplan</CardTitle>
                </div>
                <CardDescription className="text-xs lg:text-sm">
                  Ziehe Benutzer auf die gewünschten Stationen
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                <div className="space-y-2">
                  {/* Header Row - Hidden on Mobile */}
                  <div className="hidden md:grid md:grid-cols-[180px_1fr] lg:grid-cols-[200px_1fr] gap-4 mb-2 px-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Station
                    </div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Zugewiesener Lotse
                    </div>
                  </div>

                  {/* Station Rows */}
                  {data.config.staffedStations.map((station) => {
                    const assigned = getAssignedUser(station);
                    const rosterEntry = data.roster.find(r => r.station === station);
                    const stationGroup = extractStationGroup(station);

                    return (
                      <div
                        key={station}
                        className={cn(
                          "flex flex-col md:grid md:grid-cols-[180px_1fr] lg:grid-cols-[200px_1fr] gap-3 md:gap-4 items-start md:items-center p-3 rounded-lg border transition-colors",
                          "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                          "border-gray-200 dark:border-gray-800",
                          assigned ? "bg-green-50 dark:bg-green-900/10" : ""
                        )}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(station)}
                      >
                        {/* Station Info */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <div className="flex-1 md:flex-initial">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100">
                                {station}
                              </span>
                              <Badge className={cn(
                                "text-xs",
                                getBadgeClassForEndorsement(stationGroup)
                              )}>
                                {stationGroup}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Assigned User Slot */}
                        <div className="min-h-[60px] w-full">
                          {assigned ? (
                            <div className="flex items-center justify-between p-2 md:p-3 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs md:text-sm font-semibold text-blue-600 dark:text-blue-400">
                                    {assigned.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                                  </span>
                                </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 truncate">
                                      {assigned.user?.name || `CID ${assigned.userCID}`}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <Badge variant="outline" className="text-[10px] h-4">
                                        {assigned.user?.rating || 'UNK'}
                                      </Badge>
                                      {assigned.endorsementGroup && (
                                        <Badge className={cn(
                                          "text-[10px] h-4",
                                          getBadgeClassForEndorsement(assigned.endorsementGroup)
                                        )}>
                                          {assigned.endorsementGroup}
                                        </Badge>
                                      )}
                                      {isTrainee(assigned.restrictions) && (
                                        <Badge className="text-[10px] h-4 bg-yellow-500 hover:bg-yellow-600 text-black">
                                          Trainee
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => rosterEntry && unassignUser(rosterEntry.id)}
                                disabled={saving}
                                className="h-8 md:h-9 text-xs text-red-600 hover:text-red-700 flex-shrink-0 ml-2"
                              >
                                <X className="h-4 w-4 md:mr-1" />
                                <span className="hidden md:inline">Entfernen</span>
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full min-h-[60px] p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                              <p className="text-xs md:text-sm text-gray-400 dark:text-gray-600 text-center">
                                Hierher ziehen zum zuweisen
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Signups Panel */}
          <div className="space-y-4">
            <Card className="border-gray-200 dark:border-gray-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <CardTitle className="text-sm font-medium">
                      Anmeldungen
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {data.signups.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                <div className="space-y-2 max-h-[400px] md:max-h-[600px] overflow-y-auto pr-1 md:pr-2">
                  {data.signups.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Keine Anmeldungen
                      </p>
                    </div>
                  ) : (
                    data.signups.map((signup) => {
                      const assigned = isUserAssigned(signup.userCID);
                      const canDrag = !assigned;
                      
                      return (
                        <div
                          key={signup.userCID}
                          className={cn(
                            "p-2.5 md:p-3 rounded-lg border transition-all touch-manipulation",
                            assigned 
                              ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 opacity-60"
                              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md cursor-move active:opacity-75",
                            canDrag && "hover:border-blue-300 dark:hover:border-blue-700"
                          )}
                          draggable={canDrag}
                          onDragStart={() => canDrag && handleDragStart(signup)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={cn(
                              "h-9 w-9 md:h-10 md:w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                              assigned 
                                ? "bg-blue-200 dark:bg-blue-800"
                                : "bg-gray-100 dark:bg-gray-800"
                            )}>
                              <span className="font-semibold text-sm md:text-base">
                                {signup.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                              </span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1 gap-2">
                                <p className="font-medium text-sm md:text-base truncate">
                                  {signup.user?.name || `CID ${signup.userCID}`}
                                </p>
                                <Badge variant="outline" className="text-[10px] h-4 flex-shrink-0">
                                  {getRatingBadge(signup.user?.rating || 0)}
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap gap-1 mb-1">
                                {signup.endorsementGroup && (
                                  <Badge className={cn(
                                    "text-[10px] h-4",
                                    getBadgeClassForEndorsement(signup.endorsementGroup)
                                  )}>
                                    {signup.endorsementGroup}
                                  </Badge>
                                )}
                                {isTrainee(signup.restrictions) && (
                                  <Badge className="text-[10px] h-4 bg-yellow-500 hover:bg-yellow-600 text-black">
                                    Trainee
                                  </Badge>
                                )}
                              </div>
                              
                              {signup.restrictions && signup.restrictions.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {signup.restrictions.map((r, i) => (
                                    <Badge key={i} variant="secondary" className="text-[8px] md:text-[9px] h-3.5 px-1.5">
                                      {r}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              
                              {/* History Information */}
                              {signup.history && signup.history.stats.totalOccurrencesChecked > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[10px] hover:bg-gray-100 dark:hover:bg-gray-800"
                                      >
                                        <History className="h-3 w-3 mr-1" />
                                        Geschichte ({signup.history.stats.totalSignups})
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80" align="start">
                                      <div className="space-y-3">
                                        <div>
                                          <h4 className="font-medium text-sm mb-2">Teilnahme-Historie</h4>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <span className="text-gray-500 dark:text-gray-400">Anmeldungen:</span>
                                              <span className="ml-1 font-medium">
                                                {signup.history.stats.totalSignups}/{signup.history.stats.totalOccurrencesChecked} 
                                                ({Math.round((signup.history.stats.totalSignups / signup.history.stats.totalOccurrencesChecked) * 100)}%)
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500 dark:text-gray-400">Eingeplant:</span>
                                              <span className="ml-1 font-medium">
                                                {signup.history.stats.totalAssigned}/{signup.history.stats.totalOccurrencesChecked} 
                                                ({Math.round(signup.history.stats.assignmentRate)}%)
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        <div className="border-t pt-2">
                                          <h5 className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">
                                            Letzte {signup.history.previousOccurrences.length} Termine
                                          </h5>
                                          <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {signup.history.previousOccurrences.map((occ) => (
                                              <div 
                                                key={occ.occurrenceId}
                                                className={cn(
                                                  "text-xs p-2 rounded border",
                                                  occ.assigned 
                                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                                    : occ.signedUp
                                                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                                    : "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800"
                                                )}
                                              >
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-medium">
                                                    {format(new Date(occ.date), "dd.MM.yyyy", { locale: de })}
                                                  </span>
                                                  {occ.assigned && (
                                                    <Badge variant="outline" className="text-[9px] h-4 bg-green-100 dark:bg-green-900">
                                                      <Check className="h-2.5 w-2.5 mr-0.5" />
                                                      Eingeplant
                                                    </Badge>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                                                  {occ.signedUp ? (
                                                    <>
                                                      <Check className="h-3 w-3 text-green-600" />
                                                      <span>Angemeldet</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Minus className="h-3 w-3 text-gray-400" />
                                                      <span>Nicht angemeldet</span>
                                                    </>
                                                  )}
                                                </div>
                                                {occ.station && (
                                                  <div className="mt-1 text-[10px] text-gray-600 dark:text-gray-400">
                                                    Station: <span className="font-medium">{occ.station}</span>
                                                  </div>
                                                )}
                                                {occ.signedUp && !occ.assigned && (
                                                  <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                                    <X className="h-3 w-3" />
                                                    <span>Nicht eingeplant</span>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                  
                                  {/* Assignment Rate Badge */}
                                  {signup.history.stats.totalSignups > 0 && (
                                    <Badge 
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] h-5 px-1.5",
                                        signup.history.stats.assignmentRate >= 70 
                                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                                          : signup.history.stats.assignmentRate >= 40
                                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                                          : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700"
                                      )}
                                    >
                                      {signup.history.stats.assignmentRate >= 70 ? (
                                        <>
                                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                                          Häufig eingeplant
                                        </>
                                      ) : signup.history.stats.assignmentRate < 40 ? (
                                        <>
                                          <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                                          Selten eingeplant
                                        </>
                                      ) : (
                                        <>
                                          {Math.round(signup.history.stats.assignmentRate)}% eingeplant
                                        </>
                                      )}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              
                              {/* ATC Session Statistics */}
                              {signup.atcStats && signup.atcStats.stationStats && Object.keys(signup.atcStats.stationStats).length > 0 && (() => {
                                const stats = signup.atcStats.stationStats;
                                const totalMinutes = Object.values(stats).reduce((sum, s) => sum + s.totalMinutes, 0);
                                const totalHours = totalMinutes / 60;
                                const experienceLevel = totalHours > 20 ? 'high' : totalHours > 5 ? 'medium' : 'low';
                                
                                return (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 px-1.5 text-[10px] hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                          <Clock className="h-3 w-3 mr-1" />
                                          Erfahrung ({totalHours.toFixed(1)}h)
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80" align="start">
                                        <div className="space-y-3">
                                          <div>
                                            <h4 className="font-medium text-sm mb-2">ATC Erfahrung</h4>
                                            <div className="text-xs mb-3">
                                              <span className="text-gray-500 dark:text-gray-400">Gesamt:</span>
                                              <span className="ml-1 font-medium text-base">
                                                {totalHours.toFixed(1)}h
                                              </span>
                                            </div>
                                          </div>
                                          
                                          <div className="border-t pt-2">
                                            <h5 className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">
                                              Stationen mit Erfahrung
                                            </h5>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                              {Object.entries(stats)
                                                .sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes)
                                                .map(([station, exp]) => (
                                                  <div 
                                                    key={station}
                                                    className="text-xs p-2 rounded border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                                  >
                                                    <div className="flex items-center justify-between mb-1">
                                                      <span className="font-medium">{station}</span>
                                                      <Badge variant="outline" className="text-[9px] h-4 bg-blue-100 dark:bg-blue-900">
                                                        {(exp.totalMinutes / 60).toFixed(1)}h
                                                      </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-gray-600 dark:text-gray-400">
                                                      <span>{exp.sessionCount} Sessions</span>
                                                      {exp.lastSession && (
                                                        <span>Letzte: {format(new Date(exp.lastSession), "dd.MM.yyyy", { locale: de })}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    
                                    {/* Experience Level Badge */}
                                    <Badge 
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] h-5 px-1.5",
                                        experienceLevel === 'high'
                                          ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                                          : experienceLevel === 'medium'
                                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                                          : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700"
                                      )}
                                    >
                                      {experienceLevel === 'high' ? (
                                        <>
                                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                                          Hoch
                                        </>
                                      ) : experienceLevel === 'low' ? (
                                        <>
                                          <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                                          Gering
                                        </>
                                      ) : (
                                        <>
                                          <Minus className="h-2.5 w-2.5 mr-0.5" />
                                          Mittel
                                        </>
                                      )}
                                    </Badge>
                                  </div>
                                );
                              })()}
                              
                              {assigned && (
                                <Badge variant="default" className="text-[8px] h-3 px-1 mt-1 bg-blue-600">
                                  Zugewiesen
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Publish Dialog */}
      <Dialog open={publishDialog} onOpenChange={setPublishDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {data.occurrence.rosterPublished
                ? "Roster zurückziehen?"
                : "Roster veröffentlichen?"}
            </DialogTitle>
            <DialogDescription>
              {data.occurrence.rosterPublished
                ? "Das Roster wird für Benutzer nicht mehr sichtbar sein."
                : "Das Roster wird für alle Benutzer sichtbar sein. Weitere Anmeldungen sind dann möglicherweise nicht mehr möglich."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => publishRoster(!data.occurrence.rosterPublished)}
              disabled={saving}
              className="bg-blue-900 hover:bg-blue-800 text-white"
            >
              {data.occurrence.rosterPublished ? "Zurückziehen" : "Veröffentlichen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}