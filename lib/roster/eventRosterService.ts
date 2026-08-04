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
import type {
  Event,
  EventRoster,
  EventRosterAssignment,
  EventRosterEditor,
  EventRosterNote,
  EventRosterSnapshot,
  EventRosterStation,
} from "@prisma/client";

// Re-export der zentralen Berechtigungslogik für bestehende Aufrufer
export {
  canEditEventRoster,
  canViewEventRoster,
  canManageRosterEditors,
  canManageEventSignups,
} from "./rosterPermissions";

export type RosterWithRelations = EventRoster & {
  stations: EventRosterStation[];
  assignments: EventRosterAssignment[];
  notes: EventRosterNote[];
  editors: EventRosterEditor[];
  snapshots: EventRosterSnapshot[];
};

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
  /** "controller" = Controller-Zuweisung (userCID gesetzt), "custom" = Label-Block */
  type?: "controller" | "custom";
  userCID?: number | null;
  label?: string | null;
  color?: string | null;
  startTime: Date;
  endTime: Date;
}

export interface ValidationError {
  code: string;
  message: string;
}

/**
 * Serverseitige Validierung eines (neuen oder geänderten) Blocks.
 *
 * Gemeinsam: gültiges Zeitfenster, innerhalb des Events, Station gehört zum Roster,
 * Station nicht doppelt belegt.
 * Controller-Blöcke zusätzlich: keine Doppelbelegung desselben Controllers.
 *
 * Bewusst NICHT hart geprüft: die Endorsement-Eignung und eine
 * zurückgezogene Anmeldung. Beides kann in der Praxis nötig sein (kurzfristige
 * Absprachen, Trainings) und wird stattdessen im Editor sichtbar markiert –
 * siehe computeWarnings im Client.
 * Custom-Blöcke: nur Label erforderlich.
 */
export async function validateAssignment(
  event: Event,
  roster: RosterWithRelations,
  input: AssignmentInput,
  ignoreAssignmentId?: number
): Promise<ValidationError | null> {
  const { stationId, startTime, endTime } = input;
  const type = input.type ?? "controller";

  if (!(startTime < endTime)) {
    return { code: "invalid_range", message: "Startzeit muss vor der Endzeit liegen" };
  }
  if (startTime < event.startTime || endTime > event.endTime) {
    return { code: "outside_event", message: "Block liegt außerhalb des Event-Zeitraums" };
  }

  const station = roster.stations.find((s) => s.id === stationId);
  if (!station) {
    return { code: "unknown_station", message: "Station gehört nicht zu diesem Roster" };
  }

  // Station kann nur einen Block gleichzeitig haben (Controller oder Custom)
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
      message: `${station.callsign} ist in diesem Zeitraum bereits belegt`,
    };
  }

  // Custom-Block: nur Label erforderlich, keine Controller-Prüfungen
  if (type === "custom") {
    if (!input.label || input.label.trim() === "") {
      return { code: "missing_label", message: "Für einen Custom-Block wird eine Bezeichnung benötigt" };
    }
    return null;
  }

  // Ab hier Controller-Block
  const userCID = input.userCID;
  if (!userCID) {
    return { code: "missing_user", message: "Kein Controller angegeben" };
  }

  // Der Controller muss dem Event überhaupt bekannt sein. Eine zurückgezogene
  // Anmeldung blockiert bewusst nicht – der Editor markiert solche Zuweisungen.
  const signups = await getCachedSignupTable(event.id);
  const entry = signups.find((s) => s.user.cid === userCID);
  if (!entry) {
    return { code: "no_signup", message: "Controller ist für dieses Event nicht angemeldet" };
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

  return null;
}

/** Roster inkl. Stationen, Zuweisungen, Notizen, Bearbeitern und Snapshot-Metadaten laden */
export async function getRosterForEvent(eventId: number): Promise<RosterWithRelations | null> {
  return prisma.eventRoster.findUnique({
    where: { eventId },
    include: {
      stations: { orderBy: { sortOrder: "asc" } },
      assignments: { orderBy: { startTime: "asc" } },
      notes: true,
      editors: true,
      snapshots: { orderBy: { createdAt: "desc" } },
    },
  });
}

// ===================================================================
// Snapshots (gespeicherte Zwischenstände)
// ===================================================================

/** JSON-Form eines Snapshots (Stationen + Zuweisungen zum Zeitpunkt des Speicherns) */
export interface RosterSnapshotData {
  slotMinutes: number;
  stations: { callsign: string; sortOrder: number }[];
  assignments: {
    stationCallsign: string;
    type: string;
    userCID: number | null;
    label: string | null;
    color: string | null;
    startTime: string;
    endTime: string;
  }[];
}

/** Aktuellen Roster-Zustand in ein serialisierbares Snapshot-Objekt fassen */
export function serializeRoster(roster: RosterWithRelations): RosterSnapshotData {
  const stationById = new Map(roster.stations.map((s) => [s.id, s]));
  return {
    slotMinutes: roster.slotMinutes,
    stations: roster.stations.map((s) => ({ callsign: s.callsign, sortOrder: s.sortOrder })),
    assignments: roster.assignments.map((a) => ({
      stationCallsign: stationById.get(a.stationId)?.callsign ?? "",
      type: a.type,
      userCID: a.userCID,
      label: a.label,
      color: a.color,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
    })),
  };
}

/**
 * Weicht der Arbeitsstand von der veröffentlichten Fassung ab?
 * Vergleicht die serialisierten Stände; Reihenfolge der Zuweisungen wird
 * normalisiert, damit reines Neuladen keinen Unterschied erzeugt.
 */
export function hasUnpublishedChanges(roster: RosterWithRelations): boolean {
  if (!roster.publishedData) return roster.assignments.length > 0;
  const norm = (d: RosterSnapshotData) =>
    JSON.stringify({
      slotMinutes: d.slotMinutes,
      stations: [...d.stations].sort((a, b) => a.callsign.localeCompare(b.callsign)),
      assignments: [...d.assignments]
        .map((a) => ({ ...a }))
        .sort((a, b) =>
          (a.stationCallsign + a.startTime + String(a.userCID ?? a.label)).localeCompare(
            b.stationCallsign + b.startTime + String(b.userCID ?? b.label)
          )
        ),
    });
  return (
    norm(serializeRoster(roster)) !==
    norm(roster.publishedData as unknown as RosterSnapshotData)
  );
}

/**
 * Roster auf einen Snapshot zurücksetzen: Stationen und Zuweisungen werden
 * vollständig durch den gespeicherten Zustand ersetzt (Notizen/Bearbeiter bleiben).
 */
export async function restoreSnapshot(
  rosterId: number,
  data: RosterSnapshotData
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (data.slotMinutes) {
      await tx.eventRoster.update({
        where: { id: rosterId },
        data: { slotMinutes: data.slotMinutes },
      });
    }

    // Alles Löschen (Zuweisungen cascaden über Station-Delete, zur Sicherheit explizit)
    await tx.eventRosterAssignment.deleteMany({ where: { rosterId } });
    await tx.eventRosterStation.deleteMany({ where: { rosterId } });

    // Stationen neu anlegen und Callsign→ID-Map aufbauen
    const callsignToId = new Map<string, number>();
    for (const s of data.stations) {
      const created = await tx.eventRosterStation.create({
        data: { rosterId, callsign: s.callsign, sortOrder: s.sortOrder },
      });
      callsignToId.set(s.callsign, created.id);
    }

    // Zuweisungen neu anlegen (nur wenn die Station noch existiert)
    for (const a of data.assignments) {
      const stationId = callsignToId.get(a.stationCallsign);
      if (!stationId) continue;
      await tx.eventRosterAssignment.create({
        data: {
          rosterId,
          stationId,
          type: a.type,
          userCID: a.userCID,
          label: a.label,
          color: a.color,
          startTime: new Date(a.startTime),
          endTime: new Date(a.endTime),
        },
      });
    }
  });
}
