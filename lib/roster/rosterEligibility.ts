import type { EventEndorsementData, SignupTableEntry } from "@/lib/cache/types";
import type { Station } from "@/lib/stations/types";
import {
  familiarizationsFromPositions,
  missingFamiliarizations,
} from "@/lib/stations/familiarizations";
import { canStaffStation, extractStationGroup, type StationGroup } from "@/lib/weeklys/stationUtils";
import { hmRangeToMinutes } from "@/lib/roster/rosterTime";

/**
 * Eignung und Verfügbarkeit für die Roster-Planung.
 *
 * Bewusst frei von React- und Server-Abhängigkeiten, damit Editor,
 * Anmeldungsseite und Auto-Roster dieselbe Prüfung benutzen. Der Editor
 * re-exportiert alles aus `_lib/rosterUtils.ts` bzw. `_lib/rosterTypes.ts`.
 */

/** Stationsmetadaten aus dem Datahub (bzw. Callsign-Heuristik) */
export interface StationMeta {
  /** Callsign der Station – Tier-1-Center-Freigaben lauten genau darauf */
  callsign: string;
  group: StationGroup | null;
  airport: string | null;
  s1Twr: boolean;
  /**
   * Nötige Familiarisierungen laut Datahub – aussen Alternativen, innen die
   * zusammen geforderten Kürzel. Leer heißt: keine Vorgabe für diese Position.
   */
  requiredFamiliarizations: string[][];
  /** gcap_status aus dem Datahub: "1" kennzeichnet eine Tier-1-Position */
  gcapStatus: string | null;
}

/** Controller = aktive Anmeldung inkl. abgeleiteter Daten */
export interface RosterController {
  cid: number;
  name: string;
  rating: string;
  entry: SignupTableEntry;
  /** Nicht-verfügbare Bereiche in Minuten seit Event-Start */
  unavailable: { start: number; end: number }[];
  /** Hat der Controller überhaupt Verfügbarkeiten angegeben? */
  hasAvailability: boolean;
  /** Wunsch-Stationen (Freitext) */
  preferredStations: string;
  remarks: string | null;
  /** Anmeldung wurde zurückgezogen, Controller aber ggf. noch eingeplant */
  withdrawn: boolean;
}

/** Datahub-Station (`/api/stations`) → Planungsmetadaten */
export function toStationMeta(st: Station): StationMeta {
  return {
    callsign: st.callsign.toUpperCase(),
    group: st.group === "Sonstiges" ? null : (st.group as StationGroup),
    airport: st.airport ?? null,
    s1Twr: st.s1Twr === true,
    requiredFamiliarizations: st.requiredFamiliarizations ?? [],
    gcapStatus: st.gcapStatus ?? null,
  };
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
    callsign: callsign.toUpperCase(),
    group: extractStationGroup(callsign),
    airport: /^[A-Z]{4}/i.test(callsign) ? callsign.substring(0, 4).toUpperCase() : null,
    s1Twr: false,
    requiredFamiliarizations: [],
    gcapStatus: null,
  };
}

/**
 * Warum darf jemand eine Station nicht besetzen?
 *
 * Bei Events über mehrere Airports ist das die entscheidende Unterscheidung:
 * „hat auf EDDL nur Ground" ist ein Freigabe-Thema und über Training lösbar,
 * „hat EDDL bei der Anmeldung abgewählt" ist eine Willensbekundung. Beides
 * pauschal als „keine Freigabe" zu melden hilft beim Planen nicht.
 */
export type EligibilityResult =
  | { ok: true; group: StationGroup | null; restrictions: string[] }
  | { ok: false; reason: "excluded_airport"; airport: string }
  | {
      ok: false;
      reason: "no_endorsement";
      airport: string | null;
      /** Die Ebenen, die tatsächlich freigegeben sind */
      allowed: string[];
      needs: StationGroup;
    }
  | {
      ok: false;
      reason: "missing_familiarization";
      /** Sektoren der Gruppe, für die keine Familiarisierung vorliegt */
      missing: string[];
    }
  | {
      ok: false;
      reason: "missing_ctr_endorsement";
      /** Die Tier-1-Position, für die die Freigabe fehlt */
      callsign: string;
    };

/** Hat der Controller diesen Airport bei der Anmeldung ausgeschlossen? */
export function hasExcludedAirport(entry: SignupTableEntry, airport: string): boolean {
  const excluded = entry.excludedAirports;
  return Array.isArray(excluded) && excluded.includes(airport);
}

/** Freigabedaten, die für diese Station gelten (Airport oder FIR-weit) */
export function endorsementDataForStation(
  entry: SignupTableEntry,
  stationAirport: string | null,
  eventAirports: string[]
): EventEndorsementData | null {
  if (stationAirport && eventAirports.includes(stationAirport)) {
    return entry.airportEndorsements?.[stationAirport] ?? null;
  }
  // Stationen ohne Airport-Bezug (FIR-CTR) laufen über die allgemeine
  // Auswertung; sonst die beste vorhandene Airport-Auswertung heranziehen.
  if (entry.endorsement) return entry.endorsement;
  const all = Object.values(entry.airportEndorsements ?? {});
  return all.length > 0 ? all[0] : null;
}

/**
 * Alle Sektorkenntnisse einer Person: die eingetragenen Familiarisierungen und
 * die, die sich aus gehaltenen Center-Positionen ergeben (Solo oder
 * Endorsement auf `EDMM_STA_CTR` heißt STA).
 */
export function heldFamiliarizations(
  data: EventEndorsementData | null | undefined
): string[] {
  return [
    ...(data?.familiarizations ?? []),
    ...familiarizationsFromPositions([
      ...(data?.ctrEndorsements ?? []),
      ...(data?.soloPositions ?? []),
    ]),
  ];
}

/**
 * Eignung inklusive Begründung.
 *
 * Bewusst keine Rangfolge: Die Freigaben stehen als Liste der tatsächlich
 * erlaubten Ebenen zur Verfügung. Ein APP-Endorsement bedeutet nicht, dass
 * auch TWR oder GND desselben Airports erlaubt sind – etwa wenn dort ein
 * T1-Endorsement fehlt oder CTR über eine FIR-Freigabe kommt. Nur wenn diese
 * Liste fehlt (ältere zwischengespeicherte Anmeldungen), fällt die Prüfung
 * auf den alten Rangvergleich zurück.
 */
export function checkEligibility(
  controller: RosterController,
  stationMeta: StationMeta,
  eventAirports: string[]
): EligibilityResult {
  const airport = stationMeta.airport;

  // Abwahl bei der Anmeldung schlägt alles andere: Wer den Airport nicht
  // fliegen will, ist dort auch mit passender Freigabe fehl am Platz.
  if (airport && eventAirports.includes(airport) && hasExcludedAirport(controller.entry, airport)) {
    return { ok: false, reason: "excluded_airport", airport };
  }

  // Unbekannte Station (nicht im Datahub, kein Callsign-Muster) → keine harte
  // Einschränkung, hier kann die Planung nichts prüfen.
  if (!stationMeta.group) return { ok: true, group: null, restrictions: [] };

  const data = endorsementDataForStation(controller.entry, airport, eventAirports);
  const restrictions = data?.restrictions ?? [];
  const levels = data?.allowedLevels;

  const permitted =
    levels && levels.length >= 0 && Array.isArray(levels)
      ? levels.includes(stationMeta.group)
      : // Rückfall für Daten ohne Ebenenliste
        canStaffStation(data?.group ?? null, stationMeta.group, stationMeta.s1Twr);

  // Sonderfall S1-TWR: Der Datahub erlaubt TWR ausdrücklich mit GND-Freigabe.
  const s1TwrOk =
    !permitted &&
    stationMeta.group === "TWR" &&
    stationMeta.s1Twr &&
    (levels ? levels.includes("GND") : false);

  if (!permitted && !s1TwrOk) {
    return {
      ok: false,
      reason: "no_endorsement",
      airport,
      allowed: levels ? [...levels] : data?.group ? [data.group] : [],
      needs: stationMeta.group,
    };
  }

  // Tier-1-Center: Eine CTR-Station mit gcapStatus "1" verlangt die Freigabe
  // für genau diese Position. Die Ebene CTR allein genügt dort nicht – anders
  // als bei den übrigen Center-Sektoren, die über die FIR-Freigabe laufen.
  // Ein Solo auf der Position zählt mit, wie schon bei den Tier-1-Airports.
  // Zwischengespeicherte Anmeldungen aus der Zeit vor diesem Feld führen die
  // Positionen nicht mit. Dort wird nicht geprüft, statt allen die Freigabe
  // abzusprechen, die sie in Wahrheit haben.
  if (stationMeta.group === "CTR" && stationMeta.gcapStatus === "1" && data?.ctrEndorsements) {
    const held = [...data.ctrEndorsements, ...(data.soloPositions ?? [])];
    if (!held.includes(stationMeta.callsign.toUpperCase())) {
      return {
        ok: false,
        reason: "missing_ctr_endorsement",
        callsign: stationMeta.callsign.toUpperCase(),
      };
    }
  }

  // Sektorkenntnis: Welche Familiarisierung eine Position verlangt, führt der
  // Datahub selbst – geprüft wird deshalb überall dort, wo er etwas vorgibt.
  {
    const missing = missingFamiliarizations(
      stationMeta.requiredFamiliarizations,
      heldFamiliarizations(data)
    );
    if (missing && missing.length > 0) {
      return { ok: false, reason: "missing_familiarization", missing };
    }
  }

  return { ok: true, group: stationMeta.group, restrictions };
}

/** Darf der Controller die Station grundsätzlich besetzen? */
export function isEligible(
  controller: RosterController,
  stationMeta: StationMeta,
  eventAirports: string[]
): boolean {
  return checkEligibility(controller, stationMeta, eventAirports).ok;
}
