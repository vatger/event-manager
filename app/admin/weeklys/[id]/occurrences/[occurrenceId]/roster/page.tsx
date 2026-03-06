"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import { 
  ArrowLeft, 
  Users, 
  Check, 
  X, 
  Save,
  Clock,
  Calendar,
  AlertCircle,
  History,
  MoreVertical,
  GraduationCap,
  ClipboardCheck,
  UserCheck,
  Search,
  Plane,
  MessageSquare,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";
import { isTrainee } from "@/lib/weeklys/traineeUtils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { getRatingFromValue } from "@/utils/ratingToValue";
import { getStationsMetadata } from "@/lib/stations/stationMetadata";
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
  assignmentType: string;
  createdAt: string;
  updatedAt: string;
  user: User | null;
}

interface RosterEntry {
  id: number;
  station: string;
  userCID: number;
  assignmentType: string;
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
  signupDeadline: string | null;
  rosterPublished: boolean;
  rosterScheduledPublish: boolean;
}

interface RosterData {
  occurrence: Occurrence;
  config: WeeklyConfig;
  signups: Signup[];
  roster: RosterEntry[];
  warnings?: {
    historyLoadError: boolean;
    atcStatsLoadError: boolean;
  };
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
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [draggedUser, setDraggedUser] = useState<Signup | null>(null);
  const [s1TwrStations, setS1TwrStations] = useState<Set<string>>(new Set());

  // Mobile click-to-assign state
  const [mobileAssignDialog, setMobileAssignDialog] = useState<{ open: boolean; station: string | null }>({
    open: false,
    station: null,
  });
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");

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

  const assignUser = async (station: string, userCID: number, assignmentType: string = "normal") => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ station, userCID, assignmentType }),
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

  const updateAssignmentType = async (rosterId: number, assignmentType: string) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster/${rosterId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentType }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update");
      }

      const labels: Record<string, string> = {
        normal: "Normal",
        cpt: "CPT",
        training: "Training",
      };
      toast.success(`Typ geändert zu: ${labels[assignmentType] || assignmentType}`);
      await fetchData();
    } catch (error: any) {
      console.error("Update type error:", error);
      toast.error(error.message || "Fehler beim Aktualisieren");
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

  const schedulePublish = async (scheduled: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/weeklys/${configId}/occurrences/${occurrenceId}/roster/schedule-publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to schedule");
      }

      toast.success(scheduled 
        ? "Ready for Takeoff! Roster wird nach Anmeldeschluss automatisch veröffentlicht." 
        : "Automatische Veröffentlichung deaktiviert.");
      await fetchData();
      setScheduleDialog(false);
    } catch (error: any) {
      console.error("Schedule error:", error);
      toast.error(error.message || "Fehler beim Planen");
    } finally {
      setSaving(false);
    }
  };

  // Helper function to normalize station callsigns for matching
  const normalizeStationForMatching = (station: string): string => {
    // Remove numeric suffixes: _1_, _2_, etc.
    let normalized = station.replace(/_[0-9]+_/g, '_');
    // Remove directional/position suffixes before the station type
    // Examples: _A_GND → _GND, _NH_APP → _APP, _N_CTR → _CTR
    normalized = normalized.replace(/_[A-Z]+_([A-Z]{3})$/, '_$1');
    return normalized.toUpperCase();
  };

  // Check if an ATC station is relevant to this event's rostered stations
  const isRelevantStation = (atcStation: string): boolean => {
    if (!data?.config?.staffedStations) return false;
    const normalizedAtc = normalizeStationForMatching(atcStation);
    return data.config.staffedStations.some(rostered => 
      normalizeStationForMatching(rostered) === normalizedAtc
    );
  };

  const getRatingBadge = (rating: number) => {
    return getRatingFromValue(rating);
  };

  const getAssignedUser = (station: string): Signup | null => {
    if (!data) return null;
    const rosterEntry = data.roster.find(r => r.station === station);
    if (!rosterEntry) return null;
    return data.signups.find(s => s.userCID === rosterEntry.userCID) || null;
  };

  const isUserAssigned = (userCID: number): boolean => {
    // A user is considered "fully assigned" only if they have a normal assignment
    // CPT/Training users can be assigned to multiple stations
    return data?.roster.some(r => r.userCID === userCID && r.assignmentType === 'normal') || false;
  };

  const getUserAssignments = (userCID: number): RosterEntry[] => {
    return data?.roster.filter(r => r.userCID === userCID) || [];
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
      // Inherit assignment type from existing assignments (CPT/Training)
      const existingAssignments = getUserAssignments(draggedUser.userCID);
      const existingType = existingAssignments.length > 0 ? existingAssignments[0].assignmentType : "normal";
      assignUser(station, draggedUser.userCID, existingType);
    }
  };

  const handleMobileAssign = (station: string) => {
    setMobileSearchQuery("");
    setMobileAssignDialog({ open: true, station });
  };

  const getAvailableSignupsForStation = (station: string | null, searchQuery: string): Signup[] => {
    if (!station || !data) return [];
    return data.signups.filter((signup) => {
      if (isUserAssigned(signup.userCID)) return false;
      if (!canUserStaffStation(signup, station)) return false;
      if (searchQuery) {
        const name = signup.user?.name?.toLowerCase() || '';
        const cid = signup.userCID.toString();
        return name.includes(searchQuery.toLowerCase()) || cid.includes(searchQuery);
      }
      return true;
    });
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
                      <span className="whitespace-nowrap">{data.config.startTime} - {data.config.endTime} lcl</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Badge 
              variant={data.occurrence.rosterPublished ? "default" : "secondary"}
              className={cn(
                "text-xs whitespace-nowrap",
                data.occurrence.rosterPublished && "bg-green-600",
                data.occurrence.rosterScheduledPublish && !data.occurrence.rosterPublished && "bg-amber-500 text-white"
              )}
            >
              {data.occurrence.rosterPublished ? (
                <Check className="h-3 w-3 mr-1" />
              ) : data.occurrence.rosterScheduledPublish ? (
                <Plane className="h-3 w-3 mr-1" />
              ) : (
                <X className="h-3 w-3 mr-1" />
              )}
              <span className="hidden sm:inline">
                {data.occurrence.rosterPublished 
                  ? "Veröffentlicht" 
                  : data.occurrence.rosterScheduledPublish 
                  ? "Ready for Takeoff" 
                  : "Nicht veröffentlicht"}
              </span>
              <span className="sm:hidden">
                {data.occurrence.rosterPublished 
                  ? "Public" 
                  : data.occurrence.rosterScheduledPublish 
                  ? "Scheduled" 
                  : "Privat"}
              </span>
            </Badge>
            
            {/* Ready for Takeoff button - only show if not yet published and deadline not passed */}
            {!data.occurrence.rosterPublished && (
              data.occurrence.rosterScheduledPublish ? (
                <Button
                  onClick={() => schedulePublish(false)}
                  disabled={saving}
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 h-8 md:h-9"
                >
                  <Plane className="h-3.5 w-3.5 md:mr-2" />
                  <span className="hidden md:inline">Scheduling deaktivieren</span>
                </Button>
              ) : (
                <Button
                  onClick={() => setScheduleDialog(true)}
                  disabled={saving}
                  size="sm"
                  variant="outline"
                  className="border-blue-400 text-orange-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 md:h-9"
                >
                  <Plane className="h-3.5 w-3.5 md:mr-2" />
                  <span className="hidden md:inline">Ready for Takeoff</span>
                </Button>
              )
            )}

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

        {/* Warnings */}
        {(data.warnings?.historyLoadError || data.warnings?.atcStatsLoadError) && (
          <div className="space-y-2">
            {data.warnings.historyLoadError && (
              <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm font-medium">
                  Teilnahme-Historie nicht verfügbar
                </AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
                  Die historischen Anmeldedaten konnten nicht geladen werden. Die Anzeige der Teilnahme-Geschichte ist für diesen Termin nicht verfügbar.
                </AlertDescription>
              </Alert>
            )}
            {data.warnings.atcStatsLoadError && (
              <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm font-medium">
                  ATC-Statistiken nicht verfügbar
                </AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
                  Die ATC-Erfahrungsdaten konnten nicht vom Server abgerufen werden. Die Erfahrungsanzeige ist für diesen Termin nicht verfügbar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

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
                  Ziehe Benutzer auf die gewünschten Stationen oder tippe auf einen freien Slot
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 lg:px-6">
                <div className="space-y-2">
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mb-3 px-1 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" />
                      <span>CPT</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" />
                      <span>Training</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
                      <span>Normal</span>
                    </div>
                  </div>

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
                    const assignmentType = rosterEntry?.assignmentType || "normal";

                    const rowBg = assigned
                      ? assignmentType === "cpt"
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : assignmentType === "training"
                        ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                        : "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                      : "border-gray-200 dark:border-gray-800";

                    const cardBorderColor = assignmentType === "cpt"
                      ? "border-red-200 dark:border-red-700"
                      : assignmentType === "training"
                      ? "border-blue-200 dark:border-blue-700"
                      : "border-blue-200 dark:border-blue-800";

                    const avatarBg = assignmentType === "cpt"
                      ? "bg-red-100 dark:bg-red-900/30"
                      : assignmentType === "training"
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-blue-100 dark:bg-blue-900/30";

                    const avatarText = assignmentType === "cpt"
                      ? "text-red-600 dark:text-red-400"
                      : assignmentType === "training"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-blue-600 dark:text-blue-400";

                    return (
                      <div
                        key={station}
                        className={cn(
                          "flex flex-col md:grid md:grid-cols-[180px_1fr] lg:grid-cols-[200px_1fr] gap-3 md:gap-4 items-start md:items-center p-3 rounded-lg border transition-colors",
                          "hover:bg-gray-50/80 dark:hover:bg-gray-800/30",
                          rowBg,
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
                                getBadgeClassForEndorsement(s1TwrStations.has(station.toUpperCase()) ? 'GND' : stationGroup)
                              )}>
                                {s1TwrStations.has(station.toUpperCase()) ? 'S1 TWR' : stationGroup}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Assigned User Slot */}
                        <div className="min-h-[60px] w-full">
                          {assigned ? (
                            <div className={cn(
                              "flex items-center justify-between p-2 md:p-3 bg-white dark:bg-gray-900 rounded-lg border",
                              cardBorderColor,
                            )}>
                              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                <div className={cn(
                                  "h-8 w-8 md:h-10 md:w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                  avatarBg,
                                )}>
                                  <span className={cn("text-xs md:text-sm font-semibold", avatarText)}>
                                    {assigned.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <p className="font-medium text-sm md:text-base text-gray-900 dark:text-gray-100 truncate">
                                      {assigned.user?.name || `CID ${assigned.userCID}`}
                                    </p>
                                    {assignmentType === "cpt" && (
                                      <Badge className="text-[9px] h-4 px-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-100">
                                        <ClipboardCheck className="h-2.5 w-2.5 mr-0.5" />
                                        CPT
                                      </Badge>
                                    )}
                                    {assignmentType === "training" && (
                                      <Badge className="text-[9px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100">
                                        <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                                        Training
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] h-4">
                                      {getRatingFromValue(assigned.user?.rating || 0)}
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
                                        T
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* 3-dot menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={saving}
                                    className="h-8 w-8 p-0 flex-shrink-0 ml-1"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => rosterEntry && updateAssignmentType(rosterEntry.id, "normal")}
                                    className={cn(assignmentType === "normal" && "bg-gray-50 dark:bg-gray-800 font-medium")}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Normal
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => rosterEntry && updateAssignmentType(rosterEntry.id, "cpt")}
                                    className={cn(assignmentType === "cpt" && "bg-red-50 dark:bg-red-900/20 font-medium text-red-700 dark:text-red-300")}
                                  >
                                    <ClipboardCheck className="h-4 w-4 mr-2 text-red-500" />
                                    Als CPT markieren
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => rosterEntry && updateAssignmentType(rosterEntry.id, "training")}
                                    className={cn(assignmentType === "training" && "bg-blue-50 dark:bg-blue-900/20 font-medium text-blue-700 dark:text-blue-300")}
                                  >
                                    <GraduationCap className="h-4 w-4 mr-2 text-blue-500" />
                                    Als Training markieren
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => rosterEntry && unassignUser(rosterEntry.id)}
                                    className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Zuweisung entfernen
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-center h-full min-h-[60px] p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/40 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                              onClick={() => handleMobileAssign(station)}
                            >
                              <div className="text-center">
                                <p className="text-xs text-gray-400 dark:text-gray-600 hidden md:block">
                                  Hierher ziehen oder
                                </p>
                                <button className="text-xs text-blue-500 dark:text-blue-400 font-medium hover:underline mt-0.5">
                                  Person auswählen
                                </button>
                              </div>
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
                      const userAssignments = getUserAssignments(signup.userCID);
                      const hasCptOrTraining = userAssignments.some(a => a.assignmentType === 'cpt' || a.assignmentType === 'training');
                      const canDrag = !assigned;
                      const cptCount = userAssignments.filter(a => a.assignmentType === 'cpt').length;
                      const trainingCount = userAssignments.filter(a => a.assignmentType === 'training').length;
                      
                      return (
                        <div
                          key={signup.userCID}
                          className={cn(
                            "p-2.5 md:p-3 rounded-lg border transition-all touch-manipulation",
                            assigned 
                              ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 opacity-60"
                              : hasCptOrTraining
                              ? "border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10 cursor-move active:opacity-75 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700"
                              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md cursor-move active:opacity-75 hover:border-blue-300 dark:hover:border-blue-700",
                          )}
                          draggable={canDrag}
                          onDragStart={() => canDrag && handleDragStart(signup)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-semibold",
                              assigned 
                                ? "bg-green-200 dark:bg-green-800"
                                : hasCptOrTraining
                                ? "bg-purple-100 dark:bg-purple-900/30"
                                : "bg-gray-100 dark:bg-gray-800"
                            )}>
                              {signup.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              {/* Name + Rating row */}
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="font-medium text-sm truncate flex-1">
                                  {signup.user?.name || `CID ${signup.userCID}`}
                                </p>
                                <Badge variant="outline" className="text-[9px] h-4 flex-shrink-0">
                                  {getRatingBadge(signup.user?.rating || 0)}
                                </Badge>
                              </div>
                              
                              {/* Endorsement + type badges */}
                              <div className="flex flex-wrap gap-1 mb-1">
                                {signup.endorsementGroup && (
                                  <Badge className={cn(
                                    "text-[9px] h-4",
                                    getBadgeClassForEndorsement(signup.endorsementGroup)
                                  )}>
                                    {signup.endorsementGroup}
                                  </Badge>
                                )}
                                {isTrainee(signup.restrictions) && (
                                  <Badge className="text-[9px] h-4 bg-yellow-500 hover:bg-yellow-600 text-black" title="Trainee">T</Badge>
                                )}
                                {cptCount > 0 && (
                                  <Badge className="text-[9px] h-4 px-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-100">
                                    <ClipboardCheck className="h-2.5 w-2.5 mr-0.5" />
                                    CPT ×{cptCount}
                                  </Badge>
                                )}
                                {trainingCount > 0 && (
                                  <Badge className="text-[9px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100">
                                    <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                                    Training ×{trainingCount}
                                  </Badge>
                                )}
                              </div>

                              {/* Restrictions */}
                              {signup.restrictions && signup.restrictions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {signup.restrictions.map((r, i) => (
                                    <Badge key={i} variant="secondary" className="text-[8px] h-3.5 px-1.5">
                                      {r}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {/* RMK */}
                              {signup.remarks && (
                                <div className="flex items-start gap-1 mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                  <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span className="line-clamp-2">{signup.remarks}</span>
                                </div>
                              )}
                              
                              {/* History + ATC stats row - compact icons */}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {/* History dot */}
                                {signup.history && signup.history.stats.totalOccurrencesChecked > 0 && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                                        <History className="h-3 w-3" />
                                        <span>
                                          {signup.history.stats.totalSignups}/{signup.history.stats.totalOccurrencesChecked}
                                        </span>
                                        {signup.history.stats.totalSignups > 0 && (
                                          <span className={cn(
                                            "text-[8px] font-medium px-1 rounded",
                                            signup.history.stats.assignmentRate >= 70
                                              ? "text-green-600 dark:text-green-400"
                                              : signup.history.stats.assignmentRate >= 40
                                              ? "text-amber-600 dark:text-amber-400"
                                              : "text-red-600 dark:text-red-400"
                                          )}>
                                            {Math.round(signup.history.stats.assignmentRate)}%
                                          </span>
                                        )}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72" align="start">
                                      <div className="space-y-3">
                                        <div>
                                          <h4 className="font-medium text-sm mb-2">Teilnahme-Historie</h4>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <span className="text-gray-500 dark:text-gray-400">Anmeldungen:</span>
                                              <span className="ml-1 font-medium">
                                                {signup.history.stats.totalSignups}/{signup.history.stats.totalOccurrencesChecked}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-gray-500 dark:text-gray-400">Eingeplant:</span>
                                              <span className="ml-1 font-medium">
                                                {Math.round(signup.history.stats.assignmentRate)}%
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="border-t pt-2">
                                          <h5 className="text-xs font-medium mb-2 text-gray-700 dark:text-gray-300">Letzte {signup.history.stats.totalOccurrencesChecked} überprüfte Termine</h5>
                                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {signup.history.previousOccurrences.map((occ) => (
                                              <div 
                                                key={occ.occurrenceId}
                                                className={cn(
                                                  "text-xs p-1.5 rounded border flex items-center justify-between",
                                                  occ.assigned 
                                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                                    : occ.signedUp
                                                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                                    : "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800"
                                                )}
                                              >
                                                <span className="font-medium">
                                                  {format(new Date(occ.date), "dd.MM.yy", { locale: de })}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                  {occ.assigned ? (
                                                    <>
                                                      <Check className="h-3 w-3 text-green-600" />
                                                      <span className="text-green-700 dark:text-green-300">{occ.station}</span>
                                                    </>
                                                  ) : occ.signedUp ? (
                                                    <span className="text-amber-600 dark:text-amber-400">Angemeldet</span>
                                                  ) : (
                                                    <span className="text-gray-400">–</span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}

                                {/* ATC experience colored clock */}
                                {signup.atcStats && signup.atcStats.stationStats && Object.keys(signup.atcStats.stationStats).length > 0 && (() => {
                                  const stats = signup.atcStats.stationStats;
                                  const relevantStats = Object.entries(stats).filter(([station]) => isRelevantStation(station));
                                  if (relevantStats.length === 0) return null;
                                  const totalMinutes = relevantStats.reduce((sum, [, s]) => sum + (s as any).totalMinutes, 0);
                                  const totalHours = totalMinutes / 60;
                                  const experienceLevel = totalHours > 20 ? 'high' : totalHours > 5 ? 'medium' : 'low';

                                  return (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button className={cn(
                                          "flex items-center gap-1 text-[10px] transition-colors",
                                          experienceLevel === 'high' 
                                            ? "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                                            : experienceLevel === 'medium'
                                            ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                        )}>
                                          <Clock className="h-3 w-3" />
                                          <span>{totalHours.toFixed(0)}h</span>
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-72" align="start">
                                        <div className="space-y-3">
                                          <h4 className="font-medium text-sm">ATC Erfahrung (relevante Stationen)</h4>
                                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {relevantStats
                                              .sort(([, a], [, b]) => (b as any).totalMinutes - (a as any).totalMinutes)
                                              .map(([station, exp]) => {
                                                const e = exp as any;
                                                return (
                                                  <div key={station} className="text-xs p-2 rounded border bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center justify-between">
                                                      <span className="font-medium">{station}</span>
                                                      <Badge variant="outline" className="text-[9px] h-4">
                                                        {(e.totalMinutes / 60).toFixed(1)}h
                                                      </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                                      <span>{e.sessionCount} Sessions</span>
                                                      {e.lastSession && (
                                                        <span>{format(new Date(e.lastSession), "dd.MM.yy", { locale: de })}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  );
                                })()}
                              </div>
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

      {/* Mobile Assign Dialog */}
      <Dialog 
        open={mobileAssignDialog.open} 
        onOpenChange={(open) => !open && setMobileAssignDialog({ open: false, station: null })}
      >
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Person zuweisen
            </DialogTitle>
            <DialogDescription>
              Station: <span className="font-medium">{mobileAssignDialog.station}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Name suchen..."
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            
            {/* Signup List */}
            <div className="overflow-y-auto space-y-2 flex-1 max-h-[50vh] pr-1">
              {(() => {
                const availableSignups = getAvailableSignupsForStation(mobileAssignDialog.station, mobileSearchQuery);
                return (
                  <>
                    {availableSignups.map((signup) => {
                      const userAssignments = getUserAssignments(signup.userCID);
                      const hasCptOrTraining = userAssignments.some(a => a.assignmentType === 'cpt' || a.assignmentType === 'training');
                      const existingType = userAssignments.length > 0 ? userAssignments[0].assignmentType : "normal";

                      return (
                        <button
                          key={signup.userCID}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border transition-all",
                            hasCptOrTraining
                              ? "border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                          )}
                          onClick={() => {
                            if (mobileAssignDialog.station) {
                              assignUser(mobileAssignDialog.station, signup.userCID, existingType);
                              setMobileAssignDialog({ open: false, station: null });
                            }
                          }}
                          disabled={saving}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                              hasCptOrTraining ? "bg-purple-100 dark:bg-purple-900/30" : "bg-gray-100 dark:bg-gray-800"
                            )}>
                              <span className="font-semibold text-sm">
                                {signup.user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {signup.user?.name || `CID ${signup.userCID}`}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                <Badge variant="outline" className="text-[9px] h-4">
                                  {getRatingBadge(signup.user?.rating || 0)}
                                </Badge>
                                {signup.endorsementGroup && (
                                  <Badge className={cn("text-[9px] h-4", getBadgeClassForEndorsement(signup.endorsementGroup))}>
                                    {signup.endorsementGroup}
                                  </Badge>
                                )}
                                {isTrainee(signup.restrictions) && (
                                  <Badge className="text-[9px] h-4 bg-yellow-500 text-black">T</Badge>
                                )}
                                {hasCptOrTraining && (
                                  <Badge className="text-[9px] h-4 px-1 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                                    CPT/Training
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Check className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                    {availableSignups.length === 0 && (
                      <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                        {mobileSearchQuery ? 'Keine Personen gefunden' : 'Keine verfügbaren Anmeldungen für diese Station'}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMobileAssignDialog({ open: false, station: null })}>
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ready for Takeoff Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-blue-500" />
              Ready for Takeoff
            </DialogTitle>
            <DialogDescription>
              Das Roster wird automatisch veröffentlicht und alle angemeldeten Personen werden benachrichtigt, sobald der Anmeldeschluss abgelaufen ist.
              {data.occurrence.signupDeadline && (
                <span className="block mt-2 font-medium text-gray-800 dark:text-gray-200">
                  Anmeldeschluss: {format(new Date(data.occurrence.signupDeadline), "dd.MM.yyyy HH:mm", { locale: de })} lcl
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => schedulePublish(true)}
              disabled={saving}
              className="bg-orange-400 hover:bg-orange-700 text-white"
            >
              <Plane className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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