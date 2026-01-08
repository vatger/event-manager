"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit, AlertCircle, PlusCircle, UserSearch, AlertTriangle, CheckCircle2, Clock, UserX, CheckCircle } from "lucide-react";
import SignupEditDialog, { EventRef } from "@/app/admin/events/[id]/_components/SignupEditDialog";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { useUser } from "@/hooks/useUser";
import type { TimeRange } from "@/types";
import { SignupTableEntry, Availability, SignupChange } from "@/lib/cache/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  parseOptOutAirports,
  getHighestEndorsementGroup,
  getAirportEndorsementGroup,
  getAirportRestrictions,
  ENDORSEMENT_GROUP_PRIORITY,
} from "@/lib/multiAirport";

// Use the shared constant for sorting priority
const PRIORITY = ENDORSEMENT_GROUP_PRIORITY;

type SignupTableColumn =
  | "cid"
  | "name"
  | "group"
  | "airports"
  | "availability"
  | "preferredStations"
  | "remarks";

export interface SignupsTableRef {
  reload: () => void;
}

interface NormalizedEventRef extends EventRef {
  airports?: string | string[];
}

interface SignupsTableProps {
  eventId: number;
  editable?: boolean;
  columns?: SignupTableColumn[];
  emptyMessage?: string;
  event?: NormalizedEventRef;
  onRefresh?: () => void;
  filteredSignups?: SignupTableEntry[]; // Optional pre-filtered signups
  currentAirport?: string; // Current airport context
  selectedAirport?: string; // Filter by specific airport
  preloadedSignups?: SignupTableEntry[]; // Preloaded signups (from parent)
}

const HEAD_LABELS: Record<SignupTableColumn, string> = {
  cid: "CID",
  name: "Name",
  group: "Group",
  airports: "Airports",
  availability: "Availability",
  preferredStations: "Desired Position",
  remarks: "RMK",
};

// 🔹 Utility
function formatAvailability(av?: { available?: TimeRange[]; unavailable?: TimeRange[] }): string {
  if (av?.unavailable && av.unavailable.length === 0) return "full";
  const ranges = av?.available ?? [];
  if (ranges.length === 0) return "-";
  return ranges.map((r) => `${r.start}z-${r.end}z`).join(", ");
}

// Helper to get change info for a specific field
function getFieldChanges(changeLog: SignupChange[] | null | undefined, fieldName: string): SignupChange[] {
  if (!changeLog || !Array.isArray(changeLog)) return [];
  return changeLog.filter(change => change.field === fieldName);
}

// Helper to format change description
function formatChangeDescription(change: SignupChange, fieldName: string): string {
  if (fieldName === 'availability') {
    const oldVal = change.oldValue ? formatAvailability(change.oldValue as Availability) : '-';
    const newVal = change.newValue ? formatAvailability(change.newValue as Availability) : '-';
    return `${oldVal} → ${newVal}`;
  } else if (fieldName === 'preferredStations') {
    const oldVal = change.oldValue || '-';
    const newVal = change.newValue || '-';
    return `${oldVal} → ${newVal}`;
  } else if (fieldName === 'remarks') {
    return 'Bemerkungen geändert';
  } else if (fieldName === 'remarksWithChanges') {
    const oldVal = change.oldValue || '-';
    const newVal = change.newValue || '-';
    return `${oldVal} → ${newVal}`;
  }
  return 'Geändert';
}

// =====================================================================
// 🔹 Hauptkomponente
// =====================================================================
const SignupsTable = forwardRef<SignupsTableRef, SignupsTableProps>(
  (
    {
      eventId,
      editable = false,
      columns = ["cid", "name", "group", "availability", "preferredStations", "remarks"],
      emptyMessage = "Keine Anmeldungen",
      event,
      onRefresh,
      filteredSignups,
      currentAirport,
      selectedAirport,
      preloadedSignups,
    },
    ref
  ) => {
    const { user, canInOwnFIR } = useUser();

    // Local state
    const [signups, setSignups] = useState<SignupTableEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<number>(0);

    // Dialog state
    const [editOpen, setEditOpen] = useState(false);
    const [editSignup, setEditSignup] = useState<SignupTableEntry | null>(null);
    
    // Use preloaded signups if provided, otherwise use filtered or fetched signups
    const displaySignups = preloadedSignups || filteredSignups || signups;

    // --------------------------------------------------------------------
    // 🔹 1️⃣ Load signups from API (cached)
    // --------------------------------------------------------------------
    const loadSignups = useCallback(async (forceRefresh = false) => {
      try {
        setLoading(true);
        setError(null);

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
        setError("Fehler beim Laden der Signups");
      } finally {
        setLoading(false);
      }
    }, [eventId]);

    // --------------------------------------------------------------------
    // 🔹 1.5️⃣ Check for updates (lightweight polling)
    // --------------------------------------------------------------------
    const checkForUpdates = useCallback(async () => {
      try {
        // Only check if we have a lastUpdate timestamp
        if (lastUpdate === 0) return;
        
        const res = await fetch(`/api/events/${eventId}/signup/full`);
        if (!res.ok) return;

        const data = await res.json();
        
        // If server has a newer timestamp, reload
        if (data.lastUpdate && data.lastUpdate > lastUpdate) {
          console.log(`[SignupsTable] Detected update, reloading... (${data.lastUpdate} > ${lastUpdate})`);
          await loadSignups(true); // Force refresh
        }
      } catch (err) {
        console.error("Update check error:", err);
        // Silently fail - don't disrupt the UI
      }
    }, [eventId, lastUpdate, loadSignups]);

    // --------------------------------------------------------------------
    // 🔹 Acknowledge changes
    // --------------------------------------------------------------------
    const acknowledgeChanges = useCallback(async (signupId: number, userCID: number) => {
      try {
        const res = await fetch(`/api/events/${eventId}/signup/${userCID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledgeChanges: true }),
        });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Fehler beim Bestätigen');
        }
        
        // Prefer parent refresh (important when using filteredSignups in multi-airport view)
        if (onRefresh) {
          onRefresh();
        } else {
          // Fallback to local reload
          await loadSignups();
        }
      } catch (err) {
        console.error('Error acknowledging changes:', err);
        alert('Fehler beim Bestätigen der Änderungen');
      }
    }, [eventId, loadSignups, onRefresh]);

    // 👇 Ref erlaubt Parent-Komponente reload() auszulösen
    useImperativeHandle(ref, () => ({
      reload: () => loadSignups(true), // Force refresh when explicitly called
    }));
    
    // Initial Load - either from API or use provided filtered signups
    useEffect(() => {
      if (filteredSignups !== undefined || preloadedSignups !== undefined) {
        // Using pre-filtered or preloaded signups from parent component
        setLoading(false);
        return;
      }
      // Load from API when no filtered signups provided
      loadSignups();
    }, [loadSignups, filteredSignups, preloadedSignups]);

    // Polling for updates (every 10 seconds when table is visible)
    useEffect(() => {
      // Don't poll if using filtered signups or preloaded signups from parent
      if (filteredSignups !== undefined || preloadedSignups !== undefined) return;
      
      // Don't poll if still loading initial data
      if (loading) return;
      
      // Set up polling interval
      const pollInterval = setInterval(() => {
        checkForUpdates();
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(pollInterval);
    }, [filteredSignups, preloadedSignups, loading, checkForUpdates]);

    // --------------------------------------------------------------------
    // 🔹 2️⃣ Group signups by endorsement level
    // --------------------------------------------------------------------
    const grouped = useMemo(() => {
      const out: Record<string, SignupTableEntry[]> = {};
      if (!Array.isArray(displaySignups)) return out;

      for (const s of displaySignups) {
        // If viewing a specific airport, use that airport's endorsement for grouping
        let label: string;
        const airportForGrouping = selectedAirport || currentAirport;
        
        if (airportForGrouping && s.airportEndorsements?.[airportForGrouping]) {
          label = s.airportEndorsements[airportForGrouping].group || s.user.rating || "UNSPEC";
        } else {
          // For "All Airports" view, use the highest endorsement level
          const highestGroup = getHighestEndorsementGroup(s.airportEndorsements);
          label = highestGroup || s.endorsement?.group || s.user.rating || "UNSPEC";
        }
        if (!out[label]) out[label] = [];
        out[label].push(s);
      }
      return out;
    }, [displaySignups, selectedAirport, currentAirport]);

    const orderedGroups = useMemo(() => {
      const keys = Object.keys(grouped);
      const idx = (v: string) => PRIORITY[v] ?? 999;
      return keys.sort((a, b) => idx(a) - idx(b));
    }, [grouped]);

    // --------------------------------------------------------------------
    // 🔹 3️⃣ Render
    // --------------------------------------------------------------------
    const hasActions = editable;
    const finalColumns = hasActions ? [...columns, "__actions__"] : columns;

    if (loading) {
      return (
        <div className="flex justify-center items-center h-32">
          <p className="text-muted-foreground">Lade Anmeldungen...</p>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    return (
      <>
        {canInOwnFIR("signups.manage") && (
          <div className="flex justify-self-end pb-2">
            <Button onClick={() => {
              setEditSignup(null);
              setEditOpen(true);
            }}
            variant={"outline"}>
              <PlusCircle />
            </Button>
          </div>
        )}

         {displaySignups.length === 0 ? (
          <div className="text-center py-12 bg-muted rounded-lg border border-dashed">
          <UserSearch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            Keine Anmeldungen gefunden
          </h3>
          <p className="text-muted-foreground">
            Derzeit gibt es noch keine Anmeldungen, für dieses Event.
          </p>
        </div>
         ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {finalColumns.map((c) => {
                  if (currentAirport && c === "airports") return null;
                  return (
                    <TableHead key={c}>
                      {c === "__actions__" ? "" : HEAD_LABELS[c as SignupTableColumn]}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {orderedGroups.map((group) => (
                <React.Fragment key={group}>
                  <TableRow>
                    <TableCell colSpan={finalColumns.length} className="bg-muted/50 font-semibold">
                      {group}
                    </TableCell>
                  </TableRow>

                  {grouped[group].map((s) => {
                    const isDeleted = !!s.deletedAt;
                    const optedOutAirports = parseOptOutAirports(s.remarks);
                    const isOptedOutOfCurrentAirport = currentAirport && optedOutAirports.includes(currentAirport);
                    const rowClassName = isDeleted ? "opacity-50" : isOptedOutOfCurrentAirport ? "opacity-40 bg-muted/30" : "";
                    
                    return (
                      <TableRow key={s.id} className={rowClassName}>
                        {finalColumns.map((col) => {
                          if(currentAirport && col === "airports") return null;
                          const cellContent = (() => {
                            switch (col) {
                              case "cid":
                                return (
                                  <span className={isDeleted ? "line-through" : ""}>
                                    {s.user.cid}
                                    {isOptedOutOfCurrentAirport && (
                                      <span className="ml-2 text-xs text-orange-600">(ausgeschlossen)</span>
                                    )}
                                  </span>
                                );

                              case "name":
                                const hasUnacknowledgedChanges = s.modifiedAfterDeadline && !s.changesAcknowledged;
                                return (
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className={isDeleted ? "line-through" : ""}>
                                        {s.user.name}
                                      </span>
                                      {hasUnacknowledgedChanges && !isDeleted && (s.user.cid === Number(user?.cid) || canInOwnFIR("signups.manage")) && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                              <div className="space-y-1">
                                                <p className="font-semibold">Geändert nach Deadline</p>
                                                <p className="text-xs text-muted-foreground">Noch nicht bestätigt</p>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {s.modifiedAfterDeadline && s.changesAcknowledged && !isDeleted && (s.user.cid === Number(user?.cid) || canInOwnFIR("signups.manage")) && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">Änderungen bestätigt</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {isDeleted && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <UserX className="h-4 w-4 text-red-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Abgemeldet am {new Date(s.deletedAt!).toLocaleString("de-DE", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                      {s.signedUpAfterDeadline && !isDeleted && canInOwnFIR("signups.manage") && (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Clock className="h-4 w-4 text-blue-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">Anmeldung nach Anmeldeschluss</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </div>
                                    {!finalColumns.includes("group") && (
                                      <Badge className={getBadgeClassForEndorsement(s.endorsement?.group || s.user.rating)}>
                                        {s.endorsement?.group || s.user.rating}
                                      </Badge>
                                    )}
                                  </div>
                                );

                              case "group":
                                // Determine which endorsement to display
                                let displayEndorsement;
                                const airportForDisplay = selectedAirport || currentAirport;
                                
                                if (airportForDisplay && s.airportEndorsements?.[airportForDisplay]) {
                                  // Show airport-specific endorsement when filtering by airport
                                  displayEndorsement = s.airportEndorsements[airportForDisplay];
                                } else if (!airportForDisplay && s.airportEndorsements) {
                                  // Show highest endorsement for "All Airports" view
                                  const highestGroup = getHighestEndorsementGroup(s.airportEndorsements);
                                  if (highestGroup) {
                                    // Find the endorsement with this group
                                    const endorsementEntry = Object.entries(s.airportEndorsements).find(
                                      ([_, e]) => e && (e as { group?: string }).group === highestGroup
                                    );
                                    displayEndorsement = endorsementEntry ? endorsementEntry[1] : s.endorsement;
                                  } else {
                                    displayEndorsement = s.endorsement;
                                  }
                                } else {
                                  displayEndorsement = s.endorsement;
                                }
                                
                                const groupLabel = displayEndorsement?.group || s.user.rating;
                                
                                return (
                                  <div className="flex flex-col">
                                    <Badge className={getBadgeClassForEndorsement(groupLabel)}>
                                      {groupLabel}
                                    </Badge>
                                    {displayEndorsement?.restrictions?.length ? (
                                      <div className="mt-1">
                                        {displayEndorsement.restrictions.map((r, idx) => (
                                          <div key={idx} className="text-xs text-muted-foreground">
                                            • {r}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );

                              case "airports":
                                // Get event airports for comparison with safe normalization
                                const eventAirports: string[] = (() => {
                                  const ea = event?.airports;
                                  if (!ea) return [];
                                  return Array.isArray(ea) ? ea : [ea];
                                })();
                                const signupAirports = s.selectedAirports && s.selectedAirports.length > 0
                                  ? s.selectedAirports
                                  : eventAirports;
                                
                                // Parse opted-out airports from remarks
                                const optedOutAirports = parseOptOutAirports(s.remarks);
                                
                                // Determine which airports user can theoretically staff
                                const canStaffAirports = s.airportEndorsements 
                                  ? Object.keys(s.airportEndorsements).filter(airport => s.airportEndorsements![airport]?.group)
                                  : [];
                                  
                                // Only show if multiple airports in event
                                if (eventAirports.length <= 1) {
                                  return <span className="text-muted-foreground">-</span>;
                                }
                                
                                return (
                                  <div className="flex flex-wrap gap-1">
                                    {/* Show selected (not opted-out) airports */}
                                    {signupAirports.map((airport) => {
                                      const airportEndorsement = s.airportEndorsements?.[airport];
                                      const hasEndorsementData = airportEndorsement && airportEndorsement.group;
                                      const isOptedOut = optedOutAirports.includes(airport);
                                      
                                      // Skip if opted out (will be shown separately)
                                      if (isOptedOut) return null;
                                      
                                      return hasEndorsementData ? (
                                        <TooltipProvider key={airport}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge 
                                              variant="outline" 
                                              className="text-xs cursor-help border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 transition-colors duration-200 px-2 py-0.5"
                                            >
                                              <CheckCircle className="w-3 h-3 mr-1" />
                                              {airport}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent 
                                            side="top" 
                                            align="center"
                                            className="w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-lg p-3"
                                          >
                                            <div className="space-y-2">
                                              {/* Header */}
                                              <div className="space-y-0.5">
                                                <div className="flex items-center gap-1.5">
                                                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                                    {airport}
                                                  </p>
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                                  Gruppe: {airportEndorsement.group}
                                                </p>
                                              </div>

                                              {/* Restrictions */}
                                              {airportEndorsement.restrictions && airportEndorsement.restrictions.length > 0 && (
                                                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    Einschränkungen:
                                                  </p>
                                                  <ul className="space-y-1">
                                                    {airportEndorsement.restrictions.map((r, i) => (
                                                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                        <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500 mt-1.5 flex-shrink-0" />
                                                        <span>{r}</span>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      ) : (
                                        <Badge key={airport} variant="outline" className="text-xs">
                                          {airport}
                                        </Badge>
                                      );
                                    })}
                                    
                                    {/* Show opted-out airports with different styling */}
                                    {optedOutAirports.map((airport) => {
                                      // Only show if they can staff this airport
                                      if (!canStaffAirports.includes(airport)) return null;
                                      
                                      const airportEndorsement = s.airportEndorsements?.[airport];
                                      const hasEndorsementData = airportEndorsement && airportEndorsement.group;
                                      
                                      return hasEndorsementData ? (
                                        <TooltipProvider key={airport}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge 
                                                variant="outline" 
                                                className="text-xs cursor-help border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 transition-colors duration-200 px-2 py-0.5"
                                              >
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                {airport}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent 
                                              side="top" 
                                              align="center"
                                              className="w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-lg p-3"
                                            >
                                              <div className="space-y-2">
                                                {/* Header */}
                                                <div className="space-y-0.5">
                                                  <div className="flex items-center gap-1.5">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                                      {airport} <span className="text-red-600 dark:text-red-400">(Ausgeschlossen)</span>
                                                    </p>
                                                  </div>
                                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                                    Gruppe: {airportEndorsement.group}
                                                  </p>
                                                </div>

                                                {/* Exclusion Warning */}
                                                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded border border-red-100 dark:border-red-800">
                                                  Via <code className="font-mono bg-red-100 dark:bg-red-900/40 px-1 rounded">!{airport}</code> in RMKs ausgeschlossen
                                                </div>

                                                {/* Restrictions */}
                                                {airportEndorsement.restrictions && airportEndorsement.restrictions.length > 0 && (
                                                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                      Einschränkungen:
                                                    </p>
                                                    <ul className="space-y-1">
                                                      {airportEndorsement.restrictions.map((r, i) => (
                                                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                                          <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500 mt-1.5 flex-shrink-0" />
                                                          <span>{r}</span>
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <Badge key={airport} variant="destructive" className="text-xs opacity-60">
                                          {airport}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                );

                              case "availability":
                                const availabilityChanges = getFieldChanges(s.changeLog, 'availability');
                                const showAvailabilityChange = availabilityChanges.length > 0 && canInOwnFIR("signups.manage") && !isDeleted && !s.changesAcknowledged;
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className={isDeleted ? "line-through" : ""}>
                                      {formatAvailability(s.availability)}
                                    </span>
                                    {showAvailabilityChange && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                          <div className="text-xs text-gray-400 font-medium cursor-help">
                                            <span className="line-through">{formatChangeDescription(availabilityChanges[0], 'availability').split("→")[0]}</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <div className="text-xs space-y-1">
                                              {availabilityChanges.map((change, idx) => (
                                                <div key={idx}>
                                                  {new Date(change.changedAt).toLocaleString("de-DE", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })}
                                                </div>
                                              ))}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                );

                              case "preferredStations":
                                const stationChanges = getFieldChanges(s.changeLog, 'preferredStations');
                                const showStationChange = stationChanges.length > 0 && canInOwnFIR("signups.manage") && !isDeleted && !s.changesAcknowledged;
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className={isDeleted ? "line-through" : ""}>
                                      {s.preferredStations || "-"}
                                    </span>
                                    {showStationChange && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="text-xs text-gray-400 font-medium cursor-help">
                                              <span className="line-through">{formatChangeDescription(stationChanges[0], 'preferredStations').split("→")[0]}</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs space-y-1">
                                              {stationChanges.map((change, idx) => (
                                                <div key={idx}>
                                                  {new Date(change.changedAt).toLocaleString("de-DE", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })}
                                                </div>
                                              ))}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                );

                              case "remarks":
                                const remarksChanges = getFieldChanges(s.changeLog, 'remarks');
                                const showRemarksChange = remarksChanges.length > 0 && canInOwnFIR("signups.manage") && !isDeleted && !s.changesAcknowledged;
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className={isDeleted ? "line-through" : ""}>
                                      {s.remarks || "-"}
                                    </span>
                                    {showRemarksChange && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="text-xs text-gray-400 font-medium cursor-help">
                                              <span className="line-through">{formatChangeDescription(remarksChanges[0], 'remarksWithChanges').split("→")[0]}</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <div className="text-xs space-y-1">
                                              {remarksChanges.map((change, idx) => (
                                                <div key={idx}>
                                                  {new Date(change.changedAt).toLocaleString("de-DE", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  })}
                                                </div>
                                              ))}
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                );

                              case "__actions__":
                                const hasUnacknowledgedChanges2 = s.modifiedAfterDeadline && !s.changesAcknowledged && !isDeleted;
                                return (
                                  <div className="flex gap-2 justify-end">
                                    {hasUnacknowledgedChanges2 && canInOwnFIR("signups.manage") && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-green-600 border-green-600 hover:bg-green-50"
                                              onClick={() => acknowledgeChanges(s.id, s.user.cid)}
                                            >
                                              <CheckCircle2 className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p className="text-xs">Änderungen bestätigen</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!canInOwnFIR("signups.manage")}
                                      onClick={() => {
                                        setEditSignup(s);
                                        setEditOpen(true);
                                      }}
                                    >
                                      <Edit />
                                    </Button>
                                  </div>
                                );

                              default:
                                return "–";
                            }
                          })();

                          return (
                            <TableCell key={`${s.id}-${col}`}>
                              {cellContent}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
         )}

        

        {editable && event && (
          <SignupEditDialog
            open={editOpen}
            onClose={() => setEditOpen(false)}
            signup={editSignup}
            event={event}
            onSaved={onRefresh}
            onDeleted={onRefresh}
          />
        )}
      </>
    );
  }
);

SignupsTable.displayName = "SignupsTable";
export default SignupsTable;
