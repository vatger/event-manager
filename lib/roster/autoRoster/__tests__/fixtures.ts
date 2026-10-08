import type { EventEndorsementData, SignupTableEntry } from "@/lib/cache/types";
import { buildControllers, type StationMeta } from "@/lib/roster/rosterEligibility";
import { extractStationGroup } from "@/lib/weeklys/stationUtils";
import {
  computeWarnings,
  resolveStationMeta,
} from "@/app/admin/events/[id]/roster/_lib/rosterUtils";
import type { Assignment, RosterStation } from "@/app/admin/events/[id]/roster/_lib/rosterTypes";
import type { FixedBlock, PlannedAssignment, PlanningInput, PlanningStation } from "../types";

/** Alle Szenarien beginnen um 16:00z */
export const EVENT_START = new Date("2026-10-10T16:00:00Z");

type Level = "DEL" | "GND" | "TWR" | "APP" | "CTR";
const ORDER: Level[] = ["DEL", "GND", "TWR", "APP", "CTR"];

export function endorsement(
  levels: Level[],
  extra: Partial<EventEndorsementData> = {}
): EventEndorsementData {
  const highest = [...levels].sort((a, b) => ORDER.indexOf(b) - ORDER.indexOf(a))[0];
  return {
    group: highest === "DEL" || !highest ? null : highest,
    allowedLevels: levels,
    restrictions: [],
    familiarizations: [],
    ctrEndorsements: [],
    soloPositions: [],
    ...extra,
  };
}

interface SignupOptions {
  /** Freigabe für alle Event-Airports und FIR-weit */
  levels?: Level[];
  endorsementExtra?: Partial<EventEndorsementData>;
  /** Abweichende Freigaben je Airport */
  airports?: Record<string, EventEndorsementData>;
  /** "HH:mm"-Bereiche (UTC), in denen die Person nicht kann */
  unavailable?: [string, string][];
  preferred?: string;
  excludedAirports?: string[];
  withdrawn?: boolean;
}

export function signup(
  cid: number,
  name: string,
  eventAirports: string[],
  opts: SignupOptions = {}
): SignupTableEntry {
  const base = endorsement(opts.levels ?? [], opts.endorsementExtra);
  const airportEndorsements: Record<string, EventEndorsementData> = {};
  for (const ap of eventAirports) airportEndorsements[ap] = opts.airports?.[ap] ?? base;
  return {
    id: cid,
    user: { cid, name, rating: "S3" },
    preferredStations: opts.preferred ?? "",
    remarks: null,
    excludedAirports: opts.excludedAirports ?? null,
    availability: {
      available: [],
      unavailable: (opts.unavailable ?? []).map(([start, end]) => ({ start, end })),
    },
    endorsement: base,
    airportEndorsements,
    selectedAirports: eventAirports.filter((ap) => !(opts.excludedAirports ?? []).includes(ap)),
    deletedAt: opts.withdrawn ? "2026-10-01T00:00:00Z" : null,
  };
}

export function station(
  id: number,
  callsign: string,
  sortOrder = id,
  meta: Partial<StationMeta> = {}
): PlanningStation {
  return {
    id,
    callsign,
    sortOrder,
    meta: {
      callsign,
      group: extractStationGroup(callsign),
      airport: callsign.substring(0, 4),
      s1Twr: false,
      requiredFamiliarizations: [],
      gcapStatus: null,
      ...meta,
    },
  };
}

export function planningInput(
  stations: PlanningStation[],
  signups: SignupTableEntry[],
  opts: {
    totalMinutes: number;
    slotMinutes?: number;
    fixed?: FixedBlock[];
    eventAirports?: string[];
  }
): PlanningInput {
  return {
    stations,
    controllers: buildControllers(signups, EVENT_START, opts.totalMinutes),
    fixed: opts.fixed ?? [],
    eventAirports: opts.eventAirports ?? ["EDDM"],
    totalMinutes: opts.totalMinutes,
    slotMinutes: opts.slotMinutes ?? 30,
  };
}

/**
 * Warnungen des Editors für die neu geplanten Blöcke – ein guter Plan
 * erzeugt keine einzige.
 */
export function warningsForPlanned(
  input: PlanningInput,
  planned: PlannedAssignment[]
): string[] {
  const stations: RosterStation[] = input.stations.map((s) => ({
    id: s.id,
    callsign: s.callsign,
    sortOrder: s.sortOrder,
  }));
  const metaMap = new Map(input.stations.map((s) => [s.callsign.toUpperCase(), s.meta]));
  let id = 1;
  const fixed: Assignment[] = input.fixed.map((f) => ({
    id: id++,
    stationId: f.stationId,
    type: f.stationId === null ? "personal" : f.userCID === null ? "custom" : "controller",
    userCID: f.userCID,
    label: f.userCID === null || f.stationId === null ? "fix" : null,
    color: null,
    start: f.start,
    end: f.end,
  }));
  const plannedIds = new Set<number>();
  const plannedAssignments: Assignment[] = planned.map((p) => {
    const a: Assignment = {
      id: id++,
      stationId: p.stationId,
      type: "controller",
      userCID: p.userCID,
      label: null,
      color: null,
      start: p.start,
      end: p.end,
    };
    plannedIds.add(a.id);
    return a;
  });
  return computeWarnings(
    [...fixed, ...plannedAssignments],
    stations,
    input.controllers,
    EVENT_START,
    (callsign) => resolveStationMeta(callsign, metaMap),
    input.eventAirports
  )
    .filter((w) => w.assignmentIds.some((x) => plannedIds.has(x)))
    .map((w) => w.message);
}
