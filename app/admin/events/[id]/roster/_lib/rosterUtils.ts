import type { SignupTableEntry } from "@/lib/cache/types";
import { STATION_GROUP_ORDER, type StationGroup } from "@/lib/weeklys/stationUtils";
import {
  formatDuration,
  MAX_CONTINUOUS_MINUTES,
  MIN_BREAK_MINUTES,
  minuteToHM,
} from "@/lib/roster/rosterTime";
import { ROSTER_FLAGS } from "@/lib/roster/rosterFlags";
import {
  checkEligibility,
  isUnavailable,
  type EligibilityResult,
} from "@/lib/roster/rosterEligibility";
import type {
  Assignment,
  ControllerMark,
  ControllerSort,
  RosterController,
  RosterStation,
  RosterWarning,
  StationMeta,
} from "./rosterTypes";

// Zeit-Helfer liegen zentral in lib/roster/rosterTime.ts, damit auch die
// Anmeldungsseite und die öffentliche Ansicht dieselbe Rechnung benutzen.
// Re-Export, damit die Aufrufer im Editor unverändert bleiben.
export {
  formatDuration,
  hmRangeToMinutes,
  MAX_CONTINUOUS_MINUTES,
  MIN_BREAK_MINUTES,
  minutesBetween,
  minuteToDate,
  minuteToHM,
  rangesOverlap,
} from "@/lib/roster/rosterTime";

// Verfügbarkeit und Eignung liegen ebenso zentral in
// lib/roster/rosterEligibility.ts – Auto-Roster und Anmeldungsseite prüfen
// damit genau wie der Editor.
export {
  buildControllers,
  checkEligibility,
  endorsementDataForStation,
  hasExcludedAirport,
  heldFamiliarizations,
  isEligible,
  isUnavailable,
  resolveStationMeta,
  type EligibilityResult,
} from "@/lib/roster/rosterEligibility";

// =====================================================================
// Wunschstationen
// =====================================================================

/**
 * Steht die Station auf der Wunschliste? Mit gedeuteten Wünschen (siehe
 * lib/roster/stationWishes.ts) zählt die Deutung, sonst der wörtliche Text.
 */
export function prefersStation(controller: RosterController, callsign: string): boolean {
  const cs = callsign.toUpperCase();
  return controller.wishes
    ? controller.wishes.preferred.has(cs)
    : controller.preferredStations.toUpperCase().includes(cs);
}

/** Hat die Person diese Station ausdrücklich ausgeschlossen („kein DEL")? */
export function avoidsStation(controller: RosterController, callsign: string): boolean {
  return controller.wishes?.avoided.has(callsign.toUpperCase()) ?? false;
}

/** Kurzfassung der Deutung für Tooltips, z. B. „EDDM_1_GND, EDDM_2_GND · nicht: EDDM_DEL" */
export function describeWishes(controller: RosterController): string | null {
  const w = controller.wishes;
  if (!w || (w.preferred.size === 0 && w.avoided.size === 0)) return null;
  const preferred = [...w.preferred].sort((a, b) => b[1] - a[1]).map(([cs]) => cs);
  return [
    preferred.length > 0 ? preferred.join(", ") : null,
    w.avoided.size > 0 ? `nicht: ${[...w.avoided].join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// =====================================================================
// Eligibility – Ableitungen für Board und Dialoge
// =====================================================================

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

/** Alle Airports des Events, die der Controller bewusst abgewählt hat */
export function excludedAirportsOf(
  entry: SignupTableEntry,
  eventAirports: string[]
): string[] {
  const excluded = Array.isArray(entry.excludedAirports) ? entry.excludedAirports : [];
  return eventAirports.filter((a) => excluded.includes(a));
}

/**
 * Vergleicht zwei Controller nach der im Controller-Board eingestellten
 * Sortierung (`ControllerFilterBar`). Wird sowohl vom Board selbst als auch
 * vom Assign-Dialog genutzt, damit die Reihenfolge an beiden Stellen
 * übereinstimmt.
 */
export function compareControllersByBoardSort(
  a: RosterController,
  b: RosterController,
  sort: ControllerSort,
  ctx: {
    assignedMinutesByCid: Map<number, number>;
    markByCid: Map<number, ControllerMark>;
    airportFilter: string | null;
    eventAirports: string[];
  }
): number {
  if (sort === "group") {
    // Nach Ebene DEL → CTR: Wer nur Delivery darf, steht oben.
    const rank = (c: RosterController) => {
      const group = getControllerGroupForStation(c.entry, ctx.airportFilter, ctx.eventAirports);
      const idx = group ? STATION_GROUP_ORDER.indexOf(group) : -1;
      return idx < 0 ? STATION_GROUP_ORDER.length : idx;
    };
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
  } else if (sort === "assigned") {
    const d =
      (ctx.assignedMinutesByCid.get(b.cid) ?? 0) - (ctx.assignedMinutesByCid.get(a.cid) ?? 0);
    if (d !== 0) return d;
  } else if (sort === "flag") {
    // Markierte zuerst (grün → orange → rot), Unmarkierte ans Ende
    const rank = (cid: number) => {
      const flag = ctx.markByCid.get(cid)?.flag ?? null;
      return flag === null ? ROSTER_FLAGS.length : ROSTER_FLAGS.indexOf(flag);
    };
    const d = rank(a.cid) - rank(b.cid);
    if (d !== 0) return d;
  }
  return a.name.localeCompare(b.name);
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

/**
 * Stabiler Schlüssel eines Hinweises.
 *
 * Er umfasst bewusst die beteiligten Blöcke: Wird ein Block verschoben,
 * entsteht ein neuer Schlüssel und der Hinweis meldet sich wieder – ein
 * einmal geprüfter Sachverhalt bleibt also nur so lange erledigt, wie er
 * unverändert ist.
 */
export function warningKey(w: RosterWarning): string {
  return [w.type, w.userCID, [...w.assignmentIds].sort((a, b) => a - b).join(",")].join("|");
}

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
    // Pausen, Stationswechsel und Freigaben betreffen nur Schichten auf einer
    // Station – ein persönlicher Block wie „Mentor" ist keine Lotsenzeit.
    const shifts = sorted.filter((a) => a.stationId !== null);

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
    for (let i = 0; i < shifts.length - 1; i++) {
      const a = shifts[i];
      const b = shifts[i + 1];
      const gap = b.start - a.end;
      if (gap <= 0 && a.stationId !== b.stationId) {
        const from = stationById.get(a.stationId ?? -1)?.callsign ?? "?";
        const to = stationById.get(b.stationId ?? -1)?.callsign ?? "?";
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
    for (const a of shifts) {
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

    // 6) Station passt nicht zur Anmeldung – erlaubt, aber sichtbar markiert.
    // Der Grund steht in der Meldung, weil er über die Lösung entscheidet.
    if (controller && stationMetaFor) {
      for (const a of shifts) {
        const station = stationById.get(a.stationId ?? -1);
        if (!station) continue;
        const meta = stationMetaFor(station.callsign);
        const check = checkEligibility(controller, meta, eventAirports);
        if (check.ok) continue;
        if (check.reason === "excluded_airport") {
          warnings.push({
            type: "airport_excluded",
            userCID: cid,
            assignmentIds: [a.id],
            message: `${name} hat ${check.airport} bei der Anmeldung abgewählt, ist aber auf ${station.callsign} eingeplant`,
          });
        } else if (check.reason === "missing_familiarization") {
          warnings.push({
            type: "missing_familiarization",
            userCID: cid,
            assignmentIds: [a.id],
            message: `${name} fehlt für ${station.callsign} die Familiarisierung (${check.missing.join(", ")})`,
          });
        } else if (check.reason === "missing_ctr_endorsement") {
          warnings.push({
            type: "not_eligible",
            userCID: cid,
            assignmentIds: [a.id],
            message: `${name} fehlt die Freigabe für ${check.callsign} – die Position ist Tier 1, CTR allein genügt nicht`,
          });
        } else {
          const where = check.airport ? ` an ${check.airport}` : "";
          const have =
            check.allowed.length > 0 ? check.allowed.join(", ") : "keine Freigabe";
          warnings.push({
            type: "not_eligible",
            userCID: cid,
            assignmentIds: [a.id],
            message: `${name} darf ${station.callsign}${where} nicht besetzen (benötigt ${check.needs}, freigegeben: ${have})`,
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
  /** Grund, falls nicht geeignet – bei Multi-Airport entscheidend */
  eligibility: EligibilityResult;
  free: boolean;
  available: boolean;
  prefersStation: boolean;
  /** Laut Anmeldung ausdrücklich nicht gewünscht */
  avoidsStation: boolean;
  assignedMinutes: number;
}

export function suggestControllers(
  controllers: RosterController[],
  assignments: Assignment[],
  station: RosterStation,
  stationMeta: StationMeta,
  eventAirports: string[],
  start: number,
  end: number,
  /** Sortierung wie im Controller-Board eingestellt – entscheidet innerhalb gleich geeigneter Controller */
  boardSort: ControllerSort,
  markByCid: Map<number, ControllerMark>,
  airportFilter: string | null
): ControllerSuggestion[] {
  const assignedByCid = new Map<number, number>();
  for (const a of assignments) {
    if (a.userCID == null) continue;
    assignedByCid.set(a.userCID, (assignedByCid.get(a.userCID) ?? 0) + (a.end - a.start));
  }

  // Zurückgezogene Anmeldungen tauchen in der Auswahl nicht mehr auf – wer
  // abgesagt hat, soll nicht versehentlich neu eingeplant werden. Bereits
  // bestehende Zuweisungen bleiben davon unberührt und werden im Plan als
  // Problem markiert.
  const suggestions = controllers
    .filter((c) => !c.withdrawn)
    .map((c) => {
      const eligibility = checkEligibility(c, stationMeta, eventAirports);
      const free = !hasOverlap(assignments, c.cid, start, end);
      const available = !isUnavailable(c, start, end);
      return {
        controller: c,
        eligible: eligibility.ok,
        eligibility,
        free,
        available,
        prefersStation: prefersStation(c, station.callsign),
        avoidsStation: avoidsStation(c, station.callsign),
        assignedMinutes: assignedByCid.get(c.cid) ?? 0,
      };
    });

  // Nicht-berechtigte werden nicht mehr ausgeblendet, sondern nach hinten
  // sortiert und im Dialog markiert – die Zuweisung bleibt möglich. Innerhalb
  // derselben Eignung entscheidet die Sortierung des Controller-Boards, damit
  // die Reihenfolge im Dialog der im Board gewohnten entspricht.
  return suggestions
    .sort((a, b) => {
      // berechtigt & frei & verfügbar zuerst, dann Wunsch-Station,
      // ausdrücklich nicht Gewünschtes nach hinten
      const score = (s: ControllerSuggestion) =>
        (s.eligibility.ok
          ? 0
          : s.eligibility.reason === "excluded_airport"
          ? 32
          : 16) +
        (s.free ? 0 : 4) +
        (s.available ? 0 : 2) +
        (s.prefersStation ? 0 : s.avoidsStation ? 1.5 : 1);
      const d = score(a) - score(b);
      if (d !== 0) return d;
      return compareControllersByBoardSort(a.controller, b.controller, boardSort, {
        assignedMinutesByCid: assignedByCid,
        markByCid,
        airportFilter,
        eventAirports,
      });
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
    // Gezählt wird Lotsenzeit – ein „Mentor"-Block ist keine
    if (a.userCID == null || a.stationId === null) continue;
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
  // Persönliche Blöcke ("Mentor") stehen hinter allen Stationen; in der
  // Stationsspalte steht dort ihre Bezeichnung.
  const order = (a: Assignment) =>
    a.stationId === null
      ? Number.MAX_SAFE_INTEGER
      : stationById.get(a.stationId)?.sortOrder ?? 0;
  const rows = [...assignments]
    .sort((a, b) => order(a) - order(b) || a.start - b.start)
    .map((a) => {
      const station =
        a.stationId === null
          ? a.label ?? "Sonstiges"
          : stationById.get(a.stationId)?.callsign ?? "?";
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
