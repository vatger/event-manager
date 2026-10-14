/**
 * Vorbereitung eines Planerlaufs: liest Plan, Anmeldungen und Wünsche und
 * übersetzt sie in das Slot-Raster des Rechenkerns – und dessen Ergebnis
 * zurück in Schichten und Kennzahlen.
 *
 * Die Eignung prüft dieselbe Funktion wie der Editor (checkEligibility), damit
 * der Planer niemanden dorthin setzt, wo der Editor anschließend warnt.
 */

import { prisma } from "@/lib/prisma";
import { fetchAllStations } from "@/lib/stations/fetchStations";
import { getCachedSignupTable, SHORT_TTL as SIGNUP_TABLE_SHORT_TTL } from "@/lib/cache/signupTableCache";
import { parseEventAirports } from "@/lib/multiAirport";
import { getRosterForEvent } from "@/lib/roster/eventRosterService";
import { minutesBetween } from "@/lib/roster/rosterTime";
import { loadS1TheoryRoster, s1TheoryRosterKnownSince } from "@/lib/training/s1TheoryRoster";
import {
  buildControllers,
  checkEligibility,
  getControllerGroupForStation,
  groupRank,
  isUnavailable,
  resolveStationMeta,
  stationMetaMapFromDatahub,
} from "@/app/admin/events/[id]/roster/_lib/rosterUtils";
import type { RosterController } from "@/app/admin/events/[id]/roster/_lib/rosterTypes";
import { toControllerPreference } from "./preferences";
import type { CoreSession } from "./core";
import {
  DEFAULT_STATION_PRIORITY,
  type ControllerPreference,
  type SolverConfig,
  type SolverControllerInput,
  type SolverInput,
  type SolverResult,
  type SolverStationInput,
} from "./types";

/** Was neben der Eingabe gebraucht wird, um das Ergebnis zurückzuübersetzen */
export interface PreparedSolve {
  input: SolverInput;
  totalMinutes: number;
  config: SolverConfig;
  /** Index im Rechenkern → Station des Plans */
  stations: { id: number; callsign: string; priority: number }[];
  /** Alle Stationen des Plans – auch die, die nicht automatisch besetzt werden */
  allStations: { id: number; callsign: string; priority: number }[];
  /** Index im Rechenkern → Controller */
  controllers: { cid: number; name: string; wishes: string[] }[];
  /** Alle aktiven Anmeldungen mit Namen (für die Kennzahlen) */
  signups: { cid: number; name: string }[];
  /** Bleibende Blöcke in Minuten seit Event-Start */
  kept: {
    id: number;
    stationId: number | null;
    type: string;
    userCID: number | null;
    start: number;
    end: number;
  }[];
  /** Controller-Schichten, die beim Übernehmen ersetzt werden, mit ihrem Stand */
  removedAssignments: SolverResult["removedAssignments"];
  /** Event-Beginn, auf den sich alle Minuten beziehen */
  eventStart: string;
  notes: string[];
}

export class SolverPreparationError extends Error {}

export async function prepareSolve(eventId: number, config: SolverConfig): Promise<PreparedSolve> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new SolverPreparationError("Event nicht gefunden");
  const roster = await getRosterForEvent(eventId);
  if (!roster) throw new SolverPreparationError("Für das Event gibt es noch keinen Besetzungsplan");

  const eventStart = event.startTime;
  const totalMinutes = Math.max(0, minutesBetween(eventStart, event.endTime));
  const g = roster.slotMinutes;
  const T = Math.max(1, Math.ceil(totalMinutes / g));
  // Nur volle Slots planen: Eine Schicht im angebrochenen letzten Slot würde
  // beim Kürzen auf das Event-Ende unter die Mindestlänge fallen
  const fullSlots = Math.floor(totalMinutes / g);
  const eventAirports = parseEventAirports(event.airports);
  const notes: string[] = [];

  const minS = Math.max(1, Math.ceil(config.minSessionMinutes / g));
  const maxS = Math.floor(config.maxSessionMinutes / g);
  // Beide Grenzen sind hart: Passt keine Rasterlänge dazwischen, gibt es keine
  // gültige Schicht (z. B. 45–50 Minuten im 30-Minuten-Raster)
  if (maxS < minS) {
    throw new SolverPreparationError(
      `Im ${g}-Minuten-Raster passt keine Schichtlänge zwischen ${config.minSessionMinutes} und ${config.maxSessionMinutes} Minuten`
    );
  }
  if (fullSlots < T) {
    notes.push(
      `Die letzten ${totalMinutes - fullSlots * g} Minuten passen nicht ins ${g}-Minuten-Raster und bleiben offen.`
    );
  }
  if (config.minSessionMinutes % g !== 0 || config.maxSessionMinutes % g !== 0) {
    notes.push(
      `Schichtlängen wurden auf das ${g}-Minuten-Raster gerundet (${minS * g}–${maxS * g} Minuten).`
    );
  }

  // Ohne Theory Roster gälten dessen Controller als volle S1 – die Planung
  // setzte sie dann still auf Stationen, die sie nicht besetzen dürfen
  if (!(await loadS1TheoryRoster())) {
    throw new SolverPreparationError(
      "Das Theory Roster der S1-Anmeldung ist gerade nicht erreichbar. Ohne es lassen sich S1-Freigaben nicht prüfen – bitte später erneut versuchen."
    );
  }

  // Eine Anmeldetabelle, die noch ohne Theory Roster berechnet wurde, bleibt
  // bis zu SHORT_TTL im Cache – kam die Liste erst seitdem, neu berechnen,
  // sonst griffe die Prüfung oben ins Leere
  const tableMayPredateRoster = Date.now() - s1TheoryRosterKnownSince() < SIGNUP_TABLE_SHORT_TTL;

  const [signups, prefRows, datahub] = await Promise.all([
    getCachedSignupTable(eventId, tableMayPredateRoster),
    prisma.eventRosterPreference.findMany({ where: { rosterId: roster.id } }),
    // Ohne Stationsdaten fehlen Familiarisierungen und die CTR-Freigaben –
    // die Planung würde dann still Ungeeignete einsetzen. Lieber abbrechen.
    // (fetchAllStations liefert bei einem Ausfall noch die zuletzt geladene
    // Liste; scheitert es, gab es nie eine.)
    fetchAllStations().catch((err) => {
      console.error("[SOLVER] Datahub nicht erreichbar:", err);
      throw new SolverPreparationError(
        "Die Stationsdaten (Datahub) sind gerade nicht erreichbar. Ohne sie lassen sich Freigaben und Familiarisierungen nicht prüfen – bitte später erneut versuchen."
      );
    }),
  ]);
  if (datahub.length === 0) {
    throw new SolverPreparationError(
      "Der Datahub hat keine Stationsdaten geliefert. Ohne sie lassen sich Freigaben und Familiarisierungen nicht prüfen – bitte später erneut versuchen."
    );
  }
  const metaMap = stationMetaMapFromDatahub(datahub);
  const prefByCid = new Map<number, ControllerPreference>(
    prefRows.map((r) => [r.userCID, toControllerPreference(r)])
  );

  // --- Stationen ---
  const allStations = roster.stations.map((s) => ({
    id: s.id,
    callsign: s.callsign,
    priority: config.stationPriorities[s.callsign] ?? DEFAULT_STATION_PRIORITY,
  }));
  const solverStations = allStations.filter((s) => s.priority > 0);
  const stationIndex = new Map(solverStations.map((s, i) => [s.id, i]));
  const skipped = allStations.filter((s) => s.priority === 0).map((s) => s.callsign);
  if (skipped.length > 0) {
    notes.push(`Nicht automatisch besetzt: ${skipped.join(", ")}.`);
  }

  // --- Wer wird geplant? ---
  const all = buildControllers(signups, eventStart, totalMinutes);
  const active = all.filter((c) => !c.withdrawn);
  const excluded = active.filter((c) => prefByCid.get(c.cid)?.excludeFromSolver);
  if (excluded.length > 0) {
    notes.push(
      `${excluded.length} ${excluded.length === 1 ? "Person ist" : "Personen sind"} von der automatischen Planung ausgenommen.`
    );
  }
  const planned: RosterController[] = active.filter((c) => !prefByCid.get(c.cid)?.excludeFromSolver);
  const plannedCids = new Set(planned.map((c) => c.cid));

  // --- Bestehende Blöcke ---
  const asMinutes = (d: Date) => minutesBetween(eventStart, d);
  const removedAssignments: PreparedSolve["removedAssignments"] = [];
  const kept: PreparedSolve["kept"] = [];
  let keptOutside = 0;
  let outsideEvent = 0;
  for (const a of roster.assignments) {
    const block = {
      id: a.id,
      stationId: a.stationId,
      type: a.type,
      userCID: a.userCID,
      start: Math.max(0, asMinutes(a.startTime)),
      end: Math.min(totalMinutes, asMinutes(a.endTime)),
    };
    // Liegt ein Block nach Verschieben oder Kürzen des Events ganz außerhalb,
    // blockiert er nichts und zählt nicht mit (sonst end < start: negative
    // Minuten, falsche Schichtzahl und Pausen). Ersetzt wird er auch nicht.
    if (block.end <= block.start) {
      outsideEvent++;
      continue;
    }
    // Ersetzt wird nur, was die Planung auch neu besetzt: Schichten auf
    // Stationen mit Priorität „Aus“ und von ausgenommenen oder abgemeldeten
    // Personen bleiben stehen
    const replaceable =
      !config.keepExisting &&
      a.type === "controller" &&
      a.stationId !== null &&
      stationIndex.has(a.stationId) &&
      a.userCID !== null &&
      plannedCids.has(a.userCID);
    if (replaceable) {
      removedAssignments.push({
        id: a.id,
        updatedAt: a.updatedAt.toISOString(),
        stationId: a.stationId,
        userCID: a.userCID,
        // Ungekürzt, wie der Editor sie kennt – sonst erkennt die Vorschau
        // überstehende Schichten nicht als ersetzt
        start: asMinutes(a.startTime),
        end: asMinutes(a.endTime),
      });
    } else {
      if (!config.keepExisting && a.type === "controller") keptOutside++;
      kept.push(block);
    }
  }
  if (outsideEvent > 0) {
    notes.push(
      `${outsideEvent} ${outsideEvent === 1 ? "Block liegt" : "Blöcke liegen"} außerhalb der Event-Zeit und ${outsideEvent === 1 ? "bleibt" : "bleiben"} unberücksichtigt.`
    );
  }
  if (keptOutside > 0) {
    notes.push(
      `${keptOutside} ${keptOutside === 1 ? "Schicht bleibt" : "Schichten bleiben"} stehen, weil Station oder Person nicht automatisch geplant wird.`
    );
  }

  // Ein Slot ist offen, solange kein bleibender Block ihn auch nur anschneidet
  const stationInputs: SolverStationInput[] = solverStations.map((s) => {
    const open = new Array<boolean>(T).fill(true);
    for (const b of kept) {
      if (b.stationId !== s.id) continue;
      const from = Math.floor(b.start / g);
      const to = Math.ceil(b.end / g);
      for (let t = Math.max(0, from); t < Math.min(T, to); t++) open[t] = false;
    }
    for (let t = fullSlots; t < T; t++) open[t] = false;
    return {
      id: s.id,
      callsign: s.callsign,
      priority: s.priority,
      level: groupRank(resolveStationMeta(s.callsign, metaMap).group),
      open,
    };
  });

  // --- Controller ---
  const controllerInputs: SolverControllerInput[] = planned.map((c) => {
    const pref = prefByCid.get(c.cid);
    const avoided = new Set(pref?.avoidedStations ?? []);
    const wishes = (pref?.preferredStations ?? []).filter((cs) =>
      solverStations.some((s) => s.callsign === cs)
    );
    const wishRank: Record<number, number> = {};
    wishes.forEach((cs, rank) => {
      const idx = solverStations.findIndex((s) => s.callsign === cs);
      if (idx >= 0 && wishRank[idx] === undefined) wishRank[idx] = rank;
    });
    // Auch Wünsche für Stationen, die nicht automatisch besetzt werden, zählen:
    // Wer nur solche nennt, kommt mit „nur Wunschstationen“ nirgends hin –
    // statt als wunschlos überall.
    const hasWishes = (pref?.preferredStations ?? []).some((cs) =>
      allStations.some((s) => s.callsign === cs)
    );

    const eligible: number[] = [];
    solverStations.forEach((s, idx) => {
      if (avoided.has(s.callsign)) return;
      if (config.onlyPreferredStations && hasWishes && wishRank[idx] === undefined) return;
      const meta = resolveStationMeta(s.callsign, metaMap);
      if (checkEligibility(c, meta, eventAirports).ok) eligible.push(idx);
    });

    // Dieselbe Prüfung wie im Editor
    const available = Array.from(
      { length: T },
      (_, t) => !isUnavailable(c, t * g, Math.min(totalMinutes, (t + 1) * g))
    );

    const fixed: SolverControllerInput["fixed"] = [];
    for (const b of kept) {
      if (b.userCID !== c.cid) continue;
      fixed.push({
        start: Math.floor(b.start / g),
        end: Math.ceil(b.end / g),
        station: b.stationId !== null ? stationIndex.get(b.stationId) ?? null : null,
        counts: b.type === "controller",
        // Belegt wird auf Slots gerundet, angerechnet nur die echte Länge
        countedSlots: (b.end - b.start) / g,
      });
    }

    const best = getControllerGroupForStation(c.entry, null, eventAirports);
    return {
      cid: c.cid,
      available,
      eligible,
      wishRank,
      hasWishes,
      maxTotalSlots:
        pref?.maxTotalMinutes != null ? Math.floor(pref.maxTotalMinutes / g) : null,
      level: groupRank(best),
      fixed,
    };
  });

  // Obergrenzen sind hart und werden aufs Raster abgerundet. Liegt eine
  // darunter unter der kürzesten Schicht, kann die Person gar nicht eingeplant
  // werden – das soll im Ergebnis stehen, nicht still passieren.
  const tooLow = planned.filter((_, i) => {
    const limit = controllerInputs[i].maxTotalSlots;
    return limit !== null && limit < minS;
  });
  if (tooLow.length > 0) {
    notes.push(
      `Persönliche Obergrenze kürzer als die kürzeste Schicht (${minS * g} Minuten), daher nicht eingeplant: ${tooLow.map((c) => c.name).join(", ")}.`
    );
  }
  const rounded = planned.filter((c) => {
    const limit = prefByCid.get(c.cid)?.maxTotalMinutes;
    return limit != null && limit % g !== 0 && Math.floor(limit / g) >= minS;
  });
  if (rounded.length > 0) {
    notes.push(
      `Persönliche Obergrenzen auf das ${g}-Minuten-Raster abgerundet: ${rounded.map((c) => c.name).join(", ")}.`
    );
  }
  if (config.maxTotalMinutes != null && Math.floor(config.maxTotalMinutes / g) < minS) {
    throw new SolverPreparationError(
      `Die Gesamtzeit je Person (${config.maxTotalMinutes} Minuten) reicht im ${g}-Minuten-Raster für keine Schicht von mindestens ${minS * g} Minuten`
    );
  }

  const noStation = planned.filter((_, i) => controllerInputs[i].eligible.length === 0);
  if (noStation.length > 0) {
    notes.push(
      `Ohne passende Station: ${noStation.map((c) => c.name).join(", ")} (Freigabe, Wünsche oder „will nicht").`
    );
  }

  const input: SolverInput = {
    slotMinutes: g,
    slotCount: T,
    stations: stationInputs,
    controllers: controllerInputs,
    minSessionSlots: minS,
    maxSessionSlots: maxS,
    preferredSessionSlots: Math.min(maxS, Math.max(minS, Math.round(config.preferredSessionMinutes / g))),
    minBreakSlots: Math.max(0, Math.ceil(config.minBreakMinutes / g)),
    maxBreakSlots:
      config.maxBreakMinutes != null ? Math.max(0, Math.floor(config.maxBreakMinutes / g)) : null,
    maxTotalSlots: config.maxTotalMinutes != null ? Math.floor(config.maxTotalMinutes / g) : null,
    preferenceWeight: config.preferenceWeight,
    fairnessWeight: config.fairnessWeight,
    timeLimitMs: config.timeLimitSeconds * 1000,
    seed: (Date.now() ^ eventId) >>> 0,
  };

  return {
    input,
    totalMinutes,
    config,
    stations: solverStations,
    allStations,
    controllers: planned.map((c) => ({
      cid: c.cid,
      name: c.name,
      wishes: prefByCid.get(c.cid)?.preferredStations ?? [],
    })),
    signups: active.map((c) => ({ cid: c.cid, name: c.name })),
    kept,
    removedAssignments,
    eventStart: eventStart.toISOString(),
    notes,
  };
}

/** Ergebnis des Rechenkerns in Schichten und Kennzahlen übersetzen */
export function buildSolverResult(
  prepared: PreparedSolve,
  sessions: CoreSession[],
  iterations: number,
  durationMs: number
): SolverResult {
  const { input, totalMinutes } = prepared;
  const g = input.slotMinutes;
  const notes = [...prepared.notes];

  const assignments = sessions
    .map((s) => ({
      stationId: prepared.stations[s.station].id,
      callsign: prepared.stations[s.station].callsign,
      userCID: prepared.controllers[s.ctrl].cid,
      start: s.start * g,
      end: Math.min(totalMinutes, s.end * g),
    }))
    .filter((a) => a.end > a.start)
    .sort((a, b) => a.callsign.localeCompare(b.callsign) || a.start - b.start);

  // --- Stationen: was ist am Ende besetzt, wo bleiben Lücken? ---
  const stations = prepared.allStations.map((st) => {
    const blocked = new Uint8Array(totalMinutes); // 1 = Custom-Block, 2 = besetzt
    for (const b of prepared.kept) {
      if (b.stationId !== st.id) continue;
      for (let m = b.start; m < b.end; m++) {
        blocked[m] = b.type === "custom" ? Math.max(blocked[m], 1) : 2;
      }
    }
    for (const a of assignments) {
      if (a.stationId !== st.id) continue;
      for (let m = a.start; m < a.end; m++) blocked[m] = 2;
    }
    let open = 0;
    let covered = 0;
    const gaps: { start: number; end: number }[] = [];
    for (let m = 0; m < totalMinutes; m++) {
      if (blocked[m] === 1) continue;
      open++;
      if (blocked[m] === 2) covered++;
      else {
        const last = gaps[gaps.length - 1];
        if (last && last.end === m) last.end = m + 1;
        else gaps.push({ start: m, end: m + 1 });
      }
    }
    return {
      callsign: st.callsign,
      priority: st.priority,
      openMinutes: open,
      coveredMinutes: covered,
      gaps,
    };
  });

  // --- Personen ---
  const indexByCid = new Map(prepared.controllers.map((c, i) => [c.cid, i]));
  const controllers = prepared.signups
    .map((s) => {
      const own = assignments.filter((a) => a.userCID === s.cid);
      const keptOwn = prepared.kept.filter((b) => b.userCID === s.cid && b.type === "controller");
      const idx = indexByCid.get(s.cid);
      const wishes = idx !== undefined ? prepared.controllers[idx].wishes : [];
      const ctrlInput = idx !== undefined ? input.controllers[idx] : null;
      return {
        cid: s.cid,
        name: s.name,
        minutes:
          own.reduce((n, a) => n + a.end - a.start, 0) +
          keptOwn.reduce((n, b) => n + b.end - b.start, 0),
        sessions: own.length + keptOwn.length,
        wishMinutes: own
          .filter((a) => wishes.includes(a.callsign))
          .reduce((n, a) => n + a.end - a.start, 0),
        plannable:
          !!ctrlInput && ctrlInput.eligible.length > 0 && ctrlInput.available.some(Boolean),
      };
    })
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  // --- Zu lange Pausen (Ziel, nicht hart) ---
  const maxBreak = prepared.config.maxBreakMinutes;
  if (maxBreak !== null) {
    const tooLong: string[] = [];
    for (const c of controllers) {
      const blocks = [
        ...assignments.filter((a) => a.userCID === c.cid).map((a) => ({ ...a, kept: false })),
        ...prepared.kept.filter((b) => b.userCID === c.cid).map((b) => ({ ...b, kept: true })),
      ].sort((a, b) => a.start - b.start);
      for (let i = 1; i < blocks.length; i++) {
        // Wie der Rechenkern: Pausen zwischen zwei bestehenden Blöcken hat
        // dieser Lauf nicht verursacht
        if (blocks[i].kept && blocks[i - 1].kept) continue;
        if (blocks[i].start - blocks[i - 1].end > maxBreak) {
          tooLong.push(c.name);
          break;
        }
      }
    }
    if (tooLong.length > 0) {
      notes.push(`Längere Pause als ${maxBreak} Minuten: ${tooLong.join(", ")}.`);
    }
  }

  return {
    assignments,
    replacesExisting: !prepared.config.keepExisting,
    removedAssignmentIds: prepared.removedAssignments.map((a) => a.id),
    removedAssignments: prepared.removedAssignments,
    eventStart: prepared.eventStart,
    stations,
    controllers,
    notes,
    iterations,
    durationMs,
  };
}
