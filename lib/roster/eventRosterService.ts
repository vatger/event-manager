import { prisma } from "@/lib/prisma";
import { fetchAllStations } from "@/lib/stations/fetchStations";
import {
  canStaffStation,
  extractStationGroup,
  STATION_GROUP_ORDER,
  StationGroup,
} from "@/lib/weeklys/stationUtils";
import { getCachedSignupTable } from "@/lib/cache/signupTableCache";
import type { SignupTableEntry } from "@/lib/cache/types";
import { parseEventAirports } from "@/lib/multiAirport";
import {
  userhasPermissiononEvent,
  isEventResponsible,
} from "@/lib/acl/permissions";
import type { Event, EventRoster, EventRosterAssignment, EventRosterStation } from "@prisma/client";

export type RosterWithRelations = EventRoster & {
  stations: EventRosterStation[];
  assignments: EventRosterAssignment[];
};

/**
 * Wer darf den Besetzungsplan eines Events bearbeiten?
 * event.edit ODER roster.publish (FIR-scoped) ODER Event-Verantwortlicher
 */
export async function canManageEventRoster(cid: number, eventId: number): Promise<boolean> {
  if (await userhasPermissiononEvent(cid, eventId, "event.edit")) return true;
  if (await userhasPermissiononEvent(cid, eventId, "roster.publish")) return true;
  if (await isEventResponsible(cid, eventId)) return true;
  return false;
}

export interface StationRequirement {
  callsign: string;
  group: StationGroup | null;
  airport: string | null;
  s1Twr: boolean;
}

/**
 * Ermittelt die Anforderung (Gruppe, Airport, S1-TWR-Flag) einer Station.
 * Nutzt Datahub-Metadaten, fällt auf die Callsign-Heuristik zurück.
 */
export async function getStationRequirement(callsign: string): Promise<StationRequirement> {
  let group: StationGroup | null = null;
  let airport: string | null = null;
  let s1Twr = false;

  try {
    const all = await fetchAllStations();
    const meta = all.find((s) => s.callsign.toUpperCase() === callsign.toUpperCase());
    if (meta) {
      if (meta.group !== "Sonstiges") group = meta.group as StationGroup;
      airport = meta.airport ?? null;
      s1Twr = meta.s1Twr === true;
    }
  } catch (err) {
    console.error("[ROSTER] Datahub-Stationen nicht verfügbar, nutze Callsign-Heuristik:", err);
  }

  if (!group) group = extractStationGroup(callsign);
  if (!airport && /^[A-Z]{4}/i.test(callsign)) airport = callsign.substring(0, 4).toUpperCase();

  return { callsign, group, airport, s1Twr };
}

/**
 * Bestimmt die (höchste) Endorsement-Gruppe eines Controllers für eine Station.
 * - Station an einem Event-Airport: airport-spezifische Gruppe (inkl. Opt-out über selectedAirports)
 * - Sonst (z. B. CTR / FIR-weit): beste Gruppe über alle Event-Airports
 */
export function getUserGroupForStation(
  entry: SignupTableEntry,
  stationAirport: string | null,
  eventAirports: string[]
): StationGroup | null {
  const rank = (g: string | null | undefined) =>
    g ? STATION_GROUP_ORDER.indexOf(g as StationGroup) : -1;

  if (stationAirport && eventAirports.includes(stationAirport)) {
    // Airport explizit vom Controller ausgeschlossen?
    if (entry.selectedAirports && !entry.selectedAirports.includes(stationAirport)) {
      return null;
    }
    const g = entry.airportEndorsements?.[stationAirport]?.group ?? null;
    return g;
  }

  // FIR-weite Station: beste Gruppe über alle (gewählten) Event-Airports
  let best: StationGroup | null = null;
  const airports = entry.selectedAirports?.length
    ? entry.selectedAirports
    : Object.keys(entry.airportEndorsements ?? {});
  for (const ap of airports) {
    const g = entry.airportEndorsements?.[ap]?.group ?? null;
    if (rank(g) > rank(best)) best = g as StationGroup;
  }
  if (!best) best = (entry.endorsement?.group as StationGroup | null) ?? null;
  return best;
}

export interface AssignmentInput {
  stationId: number;
  userCID: number;
  startTime: Date;
  endTime: Date;
}

export interface ValidationError {
  code: string;
  message: string;
}

/**
 * Serverseitige Validierung einer (neuen oder geänderten) Zuweisung.
 * Harte Regeln: Zeitfenster, Station gehört zum Roster, aktive Anmeldung,
 * Eligibility (Endorsement-Gruppe), keine zeitliche Doppelbelegung.
 */
export async function validateAssignment(
  event: Event,
  roster: RosterWithRelations,
  input: AssignmentInput,
  ignoreAssignmentId?: number
): Promise<ValidationError | null> {
  const { stationId, userCID, startTime, endTime } = input;

  if (!(startTime < endTime)) {
    return { code: "invalid_range", message: "Startzeit muss vor der Endzeit liegen" };
  }
  if (startTime < event.startTime || endTime > event.endTime) {
    return { code: "outside_event", message: "Zuweisung liegt außerhalb des Event-Zeitraums" };
  }

  const station = roster.stations.find((s) => s.id === stationId);
  if (!station) {
    return { code: "unknown_station", message: "Station gehört nicht zu diesem Roster" };
  }

  // Aktive Anmeldung erforderlich
  const signups = await getCachedSignupTable(event.id);
  const entry = signups.find((s) => s.user.cid === userCID && !s.deletedAt);
  if (!entry) {
    return { code: "no_signup", message: "Controller hat keine aktive Anmeldung für dieses Event" };
  }

  // Eligibility: Endorsement-Gruppe muss die Station abdecken
  const requirement = await getStationRequirement(station.callsign);
  if (requirement.group) {
    const eventAirports = parseEventAirports(event.airports);
    const userGroup = getUserGroupForStation(entry, requirement.airport, eventAirports);
    if (!canStaffStation(userGroup, requirement.group, requirement.s1Twr)) {
      return {
        code: "not_eligible",
        message: `${entry.user.name} darf ${station.callsign} nicht besetzen (Freigabe: ${userGroup ?? "keine"}, benötigt: ${requirement.group})`,
      };
    }
  }

  // Keine zeitliche Doppelbelegung desselben Controllers
  const overlap = roster.assignments.find(
    (a) =>
      a.id !== ignoreAssignmentId &&
      a.userCID === userCID &&
      a.startTime < endTime &&
      startTime < a.endTime
  );
  if (overlap) {
    const otherStation = roster.stations.find((s) => s.id === overlap.stationId);
    return {
      code: "overlap",
      message: `${entry.user.name} ist in diesem Zeitraum bereits eingeplant (${otherStation?.callsign ?? "andere Station"})`,
    };
  }

  // Station kann nur von einem Controller gleichzeitig besetzt werden
  const stationOverlap = roster.assignments.find(
    (a) =>
      a.id !== ignoreAssignmentId &&
      a.stationId === stationId &&
      a.startTime < endTime &&
      startTime < a.endTime
  );
  if (stationOverlap) {
    return {
      code: "station_occupied",
      message: `${station.callsign} ist in diesem Zeitraum bereits besetzt`,
    };
  }

  return null;
}

/** Roster inkl. Stationen und Zuweisungen laden */
export async function getRosterForEvent(eventId: number): Promise<RosterWithRelations | null> {
  return prisma.eventRoster.findUnique({
    where: { eventId },
    include: {
      stations: { orderBy: { sortOrder: "asc" } },
      assignments: { orderBy: { startTime: "asc" } },
    },
  });
}
