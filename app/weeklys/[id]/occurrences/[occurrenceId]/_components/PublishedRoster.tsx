"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40">
        <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">{initials}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{entry.user?.name ?? `CID ${entry.userCID}`}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {entry.user?.rating && (
            <Badge variant="outline" className="h-4 text-[10px]">
              {getRatingFromValue(entry.user.rating)}
            </Badge>
          )}
          {entry.endorsementGroup && (
            <Badge className={cn("h-4 text-[10px]", getBadgeClassForEndorsement(entry.endorsementGroup))}>
              {entry.endorsementGroup}
            </Badge>
          )}
          {entry.restrictions && isTrainee(entry.restrictions) && (
            <Badge className="h-4 bg-warning-600 text-[10px] text-warning-950 hover:bg-warning-700">T</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/** Rahmenfarben je Zuweisungsart – dieselben drei Bedeutungen wie überall sonst im System. */
const ROW_TONE: Record<RowGroup["groupType"], string> = {
  empty: "bg-muted/40 border-border",
  normal: "bg-success-50 border-success-200 dark:bg-success-900/10 dark:border-success-800",
  cpt: "bg-accent-500/10 border-accent-500/30",
  training: "bg-primary-50 border-primary-200 dark:bg-primary-900/10 dark:border-primary-800",
};

/**
 * Rand-Streifen mit gedrehtem CPT/Training-Text – wie zuvor, aber als echtes
 * Flex-Geschwister statt absolut positioniert. So beansprucht er seine
 * eigene Breite, statt auf schmalen Bildschirmen über Name und Badges zu
 * liegen und sie zu verdecken.
 */
function TypeMarker({ type }: { type: "cpt" | "training" }) {
  const isCpt = type === "cpt";
  return (
    <div
      className={cn(
        "flex w-7 shrink-0 items-center justify-center",
        isCpt ? "bg-accent-500" : "bg-primary-700"
      )}
    >
      <span className="-rotate-90 whitespace-nowrap text-[10px] font-bold text-white">
        {isCpt ? "CPT" : "TRG"}
      </span>
    </div>
  );
}

function NormalRow({ row }: { row: StationRow }) {
  const isEmpty = !row.entry;
  const isCpt = row.entry?.assignmentType === "cpt";
  const isTrainingType = row.entry?.assignmentType === "training";
  const groupType = isEmpty ? "empty" : isCpt ? "cpt" : isTrainingType ? "training" : "normal";

  return (
    <div className={cn("flex overflow-hidden rounded-lg border transition-colors", ROW_TONE[groupType])}>
      <div
        className={cn(
          // Auf dem Handy stapeln sich Station und Lotse mit voller Breite statt
          // sich eine feste 130px-Spalte zu teilen – vorher blieb dem Namen und
          // seinen Badges kaum Platz.
          "grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4"
        )}
      >
        <span className="font-mono text-sm font-medium text-foreground">{row.station}</span>
        {row.entry ? <UserInfo entry={row.entry} /> : <p className="text-sm text-muted-foreground">Nicht besetzt</p>}
      </div>
      {(isCpt || isTrainingType) && <TypeMarker type={isCpt ? "cpt" : "training"} />}
    </div>
  );
}

function GroupedBlock({ group }: { group: RowGroup }) {
  const isCpt = group.groupType === "cpt";

  return (
    <div
      className={cn("flex overflow-hidden rounded-lg border transition-colors", ROW_TONE[group.groupType])}
    >
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4">
        {/* Mehrere Stationen desselben CPT-/Trainingsblocks als umbrechende Kürzel-Liste statt gestapelter Spalte */}
        <div className="flex flex-wrap items-center gap-1.5">
          {group.rows.map((row) => (
            <span key={row.station} className="font-mono text-sm font-medium text-foreground">
              {row.station}
            </span>
          ))}
        </div>
        {group.entry && <UserInfo entry={group.entry} />}
      </div>
      <TypeMarker type={isCpt ? "cpt" : "training"} />
    </div>
  );
}

export function PublishedRoster({ staffedStations, roster }: PublishedRosterProps) {
  const groups = buildGroups(staffedStations, roster);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-success-600" />
            <CardTitle className="text-lg">Besetzungsplan</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-[10px] sm:gap-3 sm:text-xs">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded bg-accent-500 sm:h-3 sm:w-3" />
              <span className="text-muted-foreground">CPT</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded bg-primary-700 sm:h-3 sm:w-3" />
              <span className="text-muted-foreground">Training</span>
            </div>
          </div>
        </div>
        <CardDescription>Das offizielle Roster für dieses Event</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-2 hidden gap-4 px-3 sm:grid sm:grid-cols-[200px_1fr]">
          <div className="text-xs font-medium text-muted-foreground">Station</div>
          <div className="text-xs font-medium text-muted-foreground">Zugewiesener Lotse</div>
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
