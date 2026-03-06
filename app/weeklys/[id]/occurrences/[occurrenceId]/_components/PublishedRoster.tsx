"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ClipboardCheck, Plane, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBadgeClassForEndorsement } from "@/utils/EndorsementBadge";
import { isTrainee } from "@/lib/weeklys/traineeUtils";
import { getRatingFromValue } from "@/utils/ratingToValue";

interface RosterEntry {
  id: number;
  station: string;
  userCID: number;
  assignmentType?: string;
  user?: { name: string; rating: number };
  endorsementGroup?: string;
  restrictions?: string[];
}

interface PublishedRosterProps {
  staffedStations: string[];
  roster: RosterEntry[];
}

interface StationRow {
  station: string;
  entry: RosterEntry | null;
}

interface RowGroup {
  rows: StationRow[];
  groupType: "cpt" | "training" | "normal" | "empty";
  entry?: RosterEntry;
}

function buildGroups(staffedStations: string[], roster: RosterEntry[]): RowGroup[] {
  const rows: StationRow[] = staffedStations.map((station) => ({
    station,
    entry: roster.find((r) => r.station === station) || null,
  }));

  const groups: RowGroup[] = [];
  let i = 0;

  while (i < rows.length) {
    const current = rows[i];
    const type = current.entry?.assignmentType;

    if (current.entry && (type === "cpt" || type === "training")) {
      const uid = current.entry.userCID;
      let j = i + 1;
      while (
        j < rows.length &&
        rows[j].entry?.userCID === uid &&
        rows[j].entry?.assignmentType === type
      ) {
        j++;
      }
      groups.push({ rows: rows.slice(i, j), groupType: type, entry: current.entry });
      i = j;
    } else {
      groups.push({
        rows: [current],
        groupType: current.entry ? "normal" : "empty",
        entry: current.entry ?? undefined,
      });
      i++;
    }
  }

  return groups;
}

function UserInfo({ entry }: { entry: RosterEntry }) {
  const initials = entry.user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "??";
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{initials}</span>
      </div>
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
          {entry.user?.name ?? `CID ${entry.userCID}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {entry.user?.rating && (
            <Badge variant="outline" className="text-[10px] h-4">
              {getRatingFromValue(entry.user.rating)}
            </Badge>
          )}
          {entry.endorsementGroup && (
            <Badge className={cn("text-[10px] h-4", getBadgeClassForEndorsement(entry.endorsementGroup))}>
              {entry.endorsementGroup}
            </Badge>
          )}
          {entry.restrictions && isTrainee(entry.restrictions) && (
            <Badge className="text-[10px] h-4 bg-yellow-500 hover:bg-yellow-600 text-black">T</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function NormalRow({ row }: { row: StationRow }) {
  const isEmpty = !row.entry;
  const isCpt = row.entry?.assignmentType === "cpt";
  const isTrainingType = row.entry?.assignmentType === "training";

  return (
    <div
      className={cn(
        "grid grid-cols-[200px_1fr] gap-4 items-center px-3 py-3 rounded-lg border transition-colors relative overflow-hidden",
        isEmpty && "bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800",
        !isEmpty && !isCpt && !isTrainingType && "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
        isCpt && "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
        isTrainingType && "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
      )}
    >
      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{row.station}</span>
      {row.entry ? (
        <UserInfo entry={row.entry} />
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-600">Nicht besetzt</p>
      )}
      
      {/* Type marker for single rows */}
      {isCpt && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-red-500 dark:bg-red-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold transform -rotate-90 whitespace-nowrap">CPT</span>
        </div>
      )}
      {isTrainingType && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-sky-500 dark:bg-sky-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold transform -rotate-90 whitespace-nowrap">TRG</span>
        </div>
      )}
    </div>
  );
}

function GroupedBlock({ group }: { group: RowGroup }) {
  const isCpt = group.groupType === "cpt";

  const blockBorder = isCpt
    ? "border-red-200 dark:border-red-800"
    : "border-blue-200 dark:border-blue-800";
  const blockBg = isCpt
    ? "bg-red-50 dark:bg-red-900/10"
    : "bg-blue-50 dark:bg-blue-900/10";
  const stationDivider = isCpt
    ? "border-red-200/70 dark:border-red-800/50"
    : "border-blue-200/70 dark:border-blue-800/50";
  const stationColBorder = isCpt
    ? "border-red-200 dark:border-red-800/60"
    : "border-blue-200 dark:border-blue-800/60";

  // The side marker
  const markerBg = isCpt
    ? "bg-red-500 dark:bg-red-600"
    : "bg-sky-500 dark:bg-sky-600";
  const markerText = "text-white text-xs font-bold";

  return (
    <div className={cn("flex rounded-lg border overflow-hidden relative", blockBorder, blockBg)}>

      

      {/* Left: stations stacked */}
      <div className={cn("flex flex-col border-r shrink-0 w-[140px]", stationColBorder)}>
        {group.rows.map((row, idx) => (
          <div
            key={row.station}
            className={cn(
              "flex items-center px-3 py-3",
              idx < group.rows.length - 1 && cn("border-b", stationDivider)
            )}
          >
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{row.station}</span>
          </div>
        ))}
      </div>
      

      {/* Center: user info vertically centered across all rows */}
      <div className="flex-1 flex items-center px-4 py-3">
        {group.entry && <UserInfo entry={group.entry} />}
      </div>
      
      {/* right side marker */}
      <div className={cn("w-8 flex items-center justify-center", markerBg)}>
        <span className={cn(markerText, "transform -rotate-90 whitespace-nowrap")}>
          {isCpt ? "CPT" : "TRG"}
        </span>
      </div>
    </div>
  );
}

export function PublishedRoster({ staffedStations, roster }: PublishedRosterProps) {
  const groups = buildGroups(staffedStations, roster);

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
            <CardTitle className="text-lg">Besetzungsplan</CardTitle>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">CPT</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded bg-sky-500" />
              <span className="text-gray-600 dark:text-gray-400">Training</span>
            </div>
          </div>
        </div>
        <CardDescription>Das offizielle Roster für dieses Event</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden sm:grid sm:grid-cols-[200px_1fr] gap-4 mb-2 px-3">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Station</div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Zugewiesener Lotse</div>
        </div>
        <div className="space-y-2">
          {groups.map((group, idx) =>
            group.groupType === "normal" || group.groupType === "empty" ? (
              <NormalRow key={idx} row={group.rows[0]} />
            ) : (
              <GroupedBlock key={idx} group={group} />
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}