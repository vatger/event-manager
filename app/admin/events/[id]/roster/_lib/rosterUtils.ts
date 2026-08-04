import type { SignupTableEntry } from "@/lib/cache/types";
import type { TimeRange } from "@/types";
import {
  canStaffStation,
  extractStationGroup,
  STATION_GROUP_ORDER,
  type StationGroup,
} from "@/lib/weeklys/stationUtils";
import type {
  Assignment,
  RosterController,
  RosterStation,
  RosterWarning,
  StationMeta,
} from "./rosterTypes";

// Warnregeln
export const MAX_CONTINUOUS_MINUTES = 120; // nach 2h ...
export const MIN_BREAK_MINUTES = 30; // ... mindestens 30 min Pause

// =====================================================================
// Zeit-Helfer (alles UTC, Minuten relativ zum Event-Start)
// =====================================================================

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function minuteToDate(eventStart: Date, minute: number): Date {
  return new Date(eventStart.getTime() + minute * 60000);
}

/** Minuten seit Event-Start → "HH:mm" (UTC) */
export function minuteToHM(eventStart: Date, minute: number): string {
  const d = minuteToDate(eventStart, minute);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * "HH:mm"-Zeitraum (aus der Anmeldung) → Minuten relativ zum Event-Start.
 * Zeiten vor dem Event-Start werden als "nach Mitternacht" interpretiert,
 * damit Events über Mitternacht funktionieren.
 */
export function hmRangeToMinutes(
  range: TimeRange,
  eventStart: Date,
  totalMinutes: number
): { start: number; end: number } | null {
  const startHM = parseHM(range.start);
  const endHM = parseHM(range.end);
  if (startHM === null || endHM === null) return null;

  const eventStartHM = eventStart.getUTCHours() * 60 + eventStart.getUTCMinutes();
  let rel = ((startHM - eventStartHM) % 1440 + 1440) % 1440;
  let relEnd = ((endHM - eventStartHM) % 1440 + 1440) % 1440;
  if (relEnd <= rel) relEnd += 1440;

  // komplett außerhalb des Events
  if (rel >= totalMinutes) return null;
  rel = Math.max(0, rel);
  relEnd = Math.min(totalMinutes, relEnd);
  if (relEnd <= rel) return null;
  return { start: rel, end: relEnd };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}min`;
}

// =====================================================================
// Controller / Verfügbarkeit
// =====================================================================

/** Aktive Anmeldungen in Controller-Modelle umwandeln */
export function buildControllers(
  signups: SignupTableEntry[],
  eventStart: Date,
  totalMinutes: number
): RosterController[] {
  // Zurückgezogene Anmeldungen bleiben erhalten und werden markiert – sonst
  // verschwänden bereits eingeplante Controller kommentarlos aus dem Plan.
  return signups
    .map((s) => {
      const unavailableRaw = s.availability?.unavailable ?? [];
      const availableRaw = s.availability?.available ?? [];
      const hasAvailability = unavailableRaw.length > 0 || availableRaw.length > 0;
      const unavailable = unavailableRaw
        .map((r) => hmRangeToMinutes(r, eventStart, totalMinutes))
        .filter((r): r is { start: number; end: number } => r !== null);
      return {
        cid: s.user.cid,
        name: s.user.name,
        rating: s.user.rating,
        entry: s,
        unavailable,
        hasAvailability,
        preferredStations: s.preferredStations ?? "",
        remarks: s.remarks,
        withdrawn: !!s.deletedAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Ist der Controller im Zeitraum als "nicht verfügbar" markiert? */
export function isUnavailable(
  controller: RosterController,
  start: number,
  end: number
): boolean {
  return controller.unavailable.some((r) => Math.max(start, r.start) < Math.min(end, r.end));
}

// =====================================================================
// Eligibility (Spiegel der Server-Logik in eventRosterService)
// =====================================================================

/** Stationsanforderung aus Datahub-Metadaten oder Callsign-Heuristik */
export function resolveStationMeta(
  callsign: string,
  datahub: Map<string, StationMeta>
): StationMeta {
  const meta = datahub.get(callsign.toUpperCase());
  if (meta) return meta;
  return {
    group: extractStationGroup(callsign),
    airport: /^[A-Z]{4}/i.test(callsign) ? callsign.substring(0, 4).toUpperCase() : null,
    s1Twr: false,
  };
}

function groupRank(g: string | null | undefined): number {
  return g ? STATION_GROUP_ORDER.indexOf(g as StationGroup) : -1;
}

/** Endorsement-Gruppe des Controllers für eine konkrete Station */
export function getControllerGroupForStation(
  entry: SignupTableEntry,
  stationAirport: string | null,
  eventAirports: string[]
): StationGroup | null {
  if (stationAirport && eventAirports.includes(stationAirport)) {
    if (entry.selectedAirports && !entry.selectedAirports.includes(stationAirport)) return null;
    return (entry.airportEndorsements?.[stationAirport]?.group as StationGroup | null) ?? null;
  }
  let best: StationGroup | null = null;
  const airports = entry.selectedAirports?.length
    ? entry.selectedAirports
    : Object.keys(entry.airportEndorsements ?? {});
  for (const ap of airports) {
    const g = entry.airportEndorsements?.[ap]?.group ?? null;
    if (groupRank(g) > groupRank(best)) best = g as StationGroup;
  }
  return best ?? ((entry.endorsement?.group as StationGroup | null) ?? null);
}

/** Darf der Controller die Station grundsätzlich besetzen? */
export function isEligible(
  controller: RosterController,
  stationMeta: StationMeta,
  eventAirports: string[]
): boolean {
  if (!stationMeta.group) return true; // unbekannte Station → keine harte Einschränkung
  const userGroup = getControllerGroupForStation(
    controller.entry,
    stationMeta.airport,
    eventAirports
  );
  return canStaffStation(userGroup, stationMeta.group, stationMeta.s1Twr);
}

/** Hat der Controller im Zeitraum bereits eine (andere) Zuweisung? */
export function hasOverlap(
  assignments: Assignment[],
  userCID: number,
  start: number,
  end: number,
  ignoreId?: number
): Assignment | undefined {
  return assignments.find(
    (a) => a.id !== ignoreId && a.userCID === userCID && a.start < end && start < a.end
  );
}

/** Ist die Station im Zeitraum bereits (durch jemand anderen) besetzt? */
export function stationOccupied(
  assignments: Assignment[],
  stationId: number,
  start: number,
  end: number,
  ignoreId?: number
): Assignment | undefined {
  return assignments.find(
    (a) => a.id !== ignoreId && a.stationId === stationId && a.start < end && start < a.end
  );
}

// =====================================================================
// Warnungen
// =====================================================================

export function computeWarnings(
  assignments: Assignment[],
  stations: RosterStation[],
  controllers: RosterController[],
  eventStart: Date,
  /** Für die Eignungsprüfung; fehlt sie, entfällt nur diese eine Warnung */
  stationMetaFor?: (callsign: string) => StationMeta,
  eventAirports: string[] = []
): RosterWarning[] {
  const warnings: RosterWarning[] = [];
  const stationById = new Map(stations.map((s) => [s.id, s]));
  const controllerByCid = new Map(controllers.map((c) => [c.cid, c]));

  // Nur Controller-Blöcke erzeugen Warnungen; Custom-Blöcke (userCID null) ausschließen
  const byUser = new Map<number, Assignment[]>();
  for (const a of assignments) {
    if (a.userCID == null) continue;
    (byUser.get(a.userCID) ?? byUser.set(a.userCID, []).get(a.userCID)!).push(a);
  }

  for (const [cid, list] of byUser) {
    const controller = controllerByCid.get(cid);
    const name = controller?.name ?? `CID ${cid}`;
    const sorted = [...list].sort((a, b) => a.start - b.start);

    // 1) Doppelbelegung (sollte serverseitig verhindert sein, zur Sicherheit anzeigen)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].start < sorted[i].end) {
        warnings.push({
          type: "overlap",
          userCID: cid,
          assignmentIds: [sorted[i].id, sorted[i + 1].id],
          message: `${name} ist um ${minuteToHM(eventStart, sorted[i + 1].start)}z doppelt eingeplant`,
        });
      }
    }

    // 2) Stationswechsel ohne Pause
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const gap = b.start - a.end;
      if (gap <= 0 && a.stationId !== b.stationId) {
        const from = stationById.get(a.stationId)?.callsign ?? "?";
        const to = stationById.get(b.stationId)?.callsign ?? "?";
        warnings.push({
          type: "no_break_switch",
          userCID: cid,
          assignmentIds: [a.id, b.id],
          message: `${name} wechselt um ${minuteToHM(eventStart, b.start)}z ohne Pause von ${from} auf ${to}`,
        });
      }
    }

    // 3) Mehr als 2h am Stück ohne mindestens 30min Pause
    // Zusammenhängende Blöcke bilden: Lücken < MIN_BREAK_MINUTES zählen nicht als Pause
    let stretchStart: number | null = null;
    let stretchEnd: number | null = null;
    const stretchIds: number[] = [];
    const flushStretch = () => {
      if (
        stretchStart !== null &&
        stretchEnd !== null &&
        stretchEnd - stretchStart > MAX_CONTINUOUS_MINUTES
      ) {
        warnings.push({
          type: "long_stretch",
          userCID: cid,
          assignmentIds: [...stretchIds],
          message: `${name} ist von ${minuteToHM(eventStart, stretchStart)}z bis ${minuteToHM(eventStart, stretchEnd)}z (${formatDuration(stretchEnd - stretchStart)}) ohne 30min-Pause eingeplant`,
        });
      }
      stretchIds.length = 0;
    };
    for (const a of sorted) {
      if (stretchEnd !== null && a.start - stretchEnd < MIN_BREAK_MINUTES) {
        stretchEnd = Math.max(stretchEnd, a.end);
        stretchIds.push(a.id);
      } else {
        flushStretch();
        stretchStart = a.start;
        stretchEnd = a.end;
        stretchIds.push(a.id);
      }
    }
    flushStretch();

    // 4) Zuweisung außerhalb der angegebenen Verfügbarkeit
    if (controller) {
      for (const a of sorted) {
        if (isUnavailable(controller, a.start, a.end)) {
          warnings.push({
            type: "unavailable",
            userCID: cid,
            assignmentIds: [a.id],
            message: `${name} ist ${minuteToHM(eventStart, a.start)}z–${minuteToHM(eventStart, a.end)}z eingeplant, aber als nicht verfügbar markiert`,
          });
        }
      }
    }

    // 5) Anmeldung zurückgezogen, Zuweisungen bestehen aber weiter
    if (controller?.withdrawn) {
      warnings.push({
        type: "withdrawn",
        userCID: cid,
        assignmentIds: sorted.map((a) => a.id),
        message: `${name} hat die Anmeldung zurückgezogen, ist aber noch ${sorted.length}× eingeplant`,
      });
    }

    // 6) Fehlende Freigabe für die Station – erlaubt, aber sichtbar markiert
    if (controller && stationMetaFor) {
      for (const a of sorted) {
        const station = stationById.get(a.stationId);
        if (!station) continue;
        const meta = stationMetaFor(station.callsign);
        if (!isEligible(controller, meta, eventAirports)) {
          const group = getControllerGroupForStation(
            controller.entry,
            meta.airport,
            eventAirports
          );
          warnings.push({
            type: "not_eligible",
            userCID: cid,
            assignmentIds: [a.id],
            message: `${name} hat keine Freigabe für ${station.callsign} (${group ?? "keine"}, benötigt: ${meta.group})`,
          });
        }
      }
    }
  }

  return warnings;
}

// =====================================================================
// Vorschläge für die Besetzung eines Zeitraums
// =====================================================================

export interface ControllerSuggestion {
  controller: RosterController;
  eligible: boolean;
  free: boolean;
  available: boolean;
  prefersStation: boolean;
  assignedMinutes: number;
}

export function suggestControllers(
  controllers: RosterController[],
  assignments: Assignment[],
  station: RosterStation,
  stationMeta: StationMeta,
  eventAirports: string[],
  start: number,
  end: number
): ControllerSuggestion[] {
  const assignedByCid = new Map<number, number>();
  for (const a of assignments) {
    if (a.userCID == null) continue;
    assignedByCid.set(a.userCID, (assignedByCid.get(a.userCID) ?? 0) + (a.end - a.start));
  }

  const suggestions = controllers.map((c) => {
    const eligible = isEligible(c, stationMeta, eventAirports);
    const free = !hasOverlap(assignments, c.cid, start, end);
    const available = !isUnavailable(c, start, end);
    const prefersStation = c.preferredStations
      .toUpperCase()
      .includes(station.callsign.toUpperCase());
    return {
      controller: c,
      eligible,
      free,
      available,
      prefersStation,
      assignedMinutes: assignedByCid.get(c.cid) ?? 0,
    };
  });

  // Nicht-berechtigte werden nicht mehr ausgeblendet, sondern nach hinten
  // sortiert und im Dialog markiert – die Zuweisung bleibt möglich.
  return suggestions
    .sort((a, b) => {
      // berechtigt & frei & verfügbar zuerst, dann Wunsch-Station,
      // dann wenigste eingeplante Zeit
      const score = (s: ControllerSuggestion) =>
        (s.eligible ? 0 : 16) +
        (s.controller.withdrawn ? 8 : 0) +
        (s.free ? 0 : 4) +
        (s.available ? 0 : 2) +
        (s.prefersStation ? 0 : 1);
      const d = score(a) - score(b);
      if (d !== 0) return d;
      if (a.assignedMinutes !== b.assignedMinutes) return a.assignedMinutes - b.assignedMinutes;
      return a.controller.name.localeCompare(b.controller.name);
    });
}

// =====================================================================
// Statistiken & Export
// =====================================================================

export function stationCoverage(
  assignments: Assignment[],
  stationId: number,
  totalMinutes: number
): number {
  const ranges = assignments
    .filter((a) => a.stationId === stationId)
    .map((a) => ({ start: a.start, end: a.end }))
    .sort((a, b) => a.start - b.start);
  let covered = 0;
  let cursor = 0;
  for (const r of ranges) {
    const s = Math.max(cursor, r.start);
    if (r.end > s) {
      covered += r.end - s;
      cursor = r.end;
    }
  }
  return totalMinutes > 0 ? covered / totalMinutes : 0;
}

export function assignedMinutesByController(assignments: Assignment[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const a of assignments) {
    if (a.userCID == null) continue;
    map.set(a.userCID, (map.get(a.userCID) ?? 0) + (a.end - a.start));
  }
  return map;
}

/** Anzeigename eines Blocks: Controller-Name oder Custom-Label */
function blockLabel(a: Assignment, controllerByCid: Map<number, RosterController>): string {
  if (a.type === "custom") return a.label ?? "Custom";
  return a.userCID != null ? controllerByCid.get(a.userCID)?.name ?? `CID ${a.userCID}` : "?";
}

/** Roster als CSV (Station;Von;Bis;CID;Name) */
export function rosterToCsv(
  assignments: Assignment[],
  stations: RosterStation[],
  controllers: RosterController[],
  eventStart: Date
): string {
  const stationById = new Map(stations.map((s) => [s.id, s]));
  const controllerByCid = new Map(controllers.map((c) => [c.cid, c]));
  const rows = [...assignments]
    .sort((a, b) => {
      const sa = stationById.get(a.stationId)?.sortOrder ?? 0;
      const sb = stationById.get(b.stationId)?.sortOrder ?? 0;
      if (sa !== sb) return sa - sb;
      return a.start - b.start;
    })
    .map((a) => {
      const station = stationById.get(a.stationId)?.callsign ?? "?";
      return [
        station,
        `${minuteToHM(eventStart, a.start)}z`,
        `${minuteToHM(eventStart, a.end)}z`,
        a.userCID != null ? String(a.userCID) : "",
        blockLabel(a, controllerByCid),
      ].join(";");
    });
  return ["Station;Von;Bis;CID;Name", ...rows].join("\n");
}

/** Roster als Markdown-Tabelle pro Station (zum Kopieren, z. B. Forum/Discord) */
export function rosterToText(
  assignments: Assignment[],
  stations: RosterStation[],
  controllers: RosterController[],
  eventStart: Date
): string {
  const controllerByCid = new Map(controllers.map((c) => [c.cid, c]));
  const lines: string[] = [];
  for (const station of [...stations].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const list = assignments
      .filter((a) => a.stationId === station.id)
      .sort((a, b) => a.start - b.start);
    if (list.length === 0) continue;
    lines.push(`**${station.callsign}**`);
    for (const a of list) {
      const who =
        a.type === "custom"
          ? a.label ?? "Custom"
          : `${blockLabel(a, controllerByCid)} (${a.userCID})`;
      lines.push(`${minuteToHM(eventStart, a.start)}z - ${minuteToHM(eventStart, a.end)}z: ${who}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
