import type { EventEndorsementData, SignupTableEntry } from "@/lib/cache/types";
import { familiarizationsFromPositions } from "@/lib/stations/familiarizations";

/**
 * Aufbereitung der Freigaben für die Anzeige.
 *
 * Center gehört nicht zu einem Platz: Die Freigabe gilt für die FIR, und
 * welchen Sektor jemand arbeiten darf, entscheiden die Familiarisierungen.
 * Solange CTR in jeder Airport-Zeile mitläuft, steht dieselbe Aussage bei einem
 * Event über acht Plätze achtmal da – zusammen mit der immer gleichen
 * Sektor-Einschränkung. Deshalb wird hier getrennt: Plätze mit ihren Ebenen,
 * Center einmal mit seinen Sektoren.
 */

/** Ebenen, die zu einem Platz gehören – CTR wird getrennt geführt */
export const AIRPORT_LEVELS = ["DEL", "GND", "TWR", "APP"] as const;
export type AirportLevel = (typeof AIRPORT_LEVELS)[number];

export interface AirportState {
  airport: string;
  /** Bei der Anmeldung abgewählt */
  excluded: boolean;
  /** Freigegebene Platz-Ebenen (ohne CTR) */
  levels: AirportLevel[];
  /** Darf hier auch Center arbeiten – für die Center-Zeile gesammelt */
  ctr: boolean;
  restrictions: string[];
  /** Signatur zum Zusammenfassen gleichartiger Airports */
  key: string;
}

export interface FamiliarizationView {
  sector: string;
  /** Kommt aus einem Solo – kennzeichnet einen Trainee auf dieser Position */
  fromSolo: boolean;
  /** Die Position, aus der das Solo stammt */
  position?: string;
}

export interface EndorsementView {
  /** Airports, an denen tatsächlich ein Platz besetzt werden kann */
  usable: AirportState[];
  /**
   * Airports, die ausfallen – abgewählt, ohne Freigabe oder nur Center.
   * Sie verschwinden nicht ganz: Dass jemand einen Platz abgewählt hat, ist
   * beim Planen genauso eine Information wie eine fehlende Freigabe.
   */
  dropped: AirportState[];
  /** Center irgendwo freigegeben? */
  hasCtr: boolean;
  /** Einschränkungen, die an jedem Airport gleich lauten – also nicht platzbezogen */
  commonRestrictions: string[];
  /** Sektorkenntnisse, Solos eigens gekennzeichnet */
  familiarizations: FamiliarizationView[];
  /** Freigaben auf einzelne Center-Positionen (Tier 1) */
  ctrPositions: { callsign: string; fromSolo: boolean }[];
  /** Solos auf Plätzen – Trainees, die dort üben sollen */
  airportSolos: string[];
}

function endorsementFor(
  entry: SignupTableEntry,
  airport: string
): EventEndorsementData | undefined {
  return entry.airportEndorsements?.[airport];
}

export function isAirportExcluded(entry: SignupTableEntry, airport: string): boolean {
  const excluded = entry.excludedAirports;
  return Array.isArray(excluded) && excluded.includes(airport);
}

/** Freigegebene Platz-Ebenen eines Airports in fester Reihenfolge */
export function levelsFor(entry: SignupTableEntry, airport: string): AirportLevel[] {
  const raw = endorsementFor(entry, airport)?.allowedLevels ?? [];
  return AIRPORT_LEVELS.filter((l) => raw.includes(l));
}

/**
 * Hat jemand eine Lücke in den Freigaben – also eine höhere Ebene ohne die
 * darunterliegende? Genau das ist der Fall, den eine Rangfolge verschluckt und
 * der beim Planen auffallen muss.
 */
export function hasEndorsementGap(data: EventEndorsementData | undefined): boolean {
  const levels = data?.allowedLevels ?? [];
  const idx = AIRPORT_LEVELS.map((l, i) => (levels.includes(l) ? i : -1)).filter(
    (i) => i >= 0
  );
  if (idx.length === 0) return false;
  const highest = Math.max(...idx);
  return idx.length !== highest + 1;
}

/** Leeres Modell – für den Fall, dass keine Auswahl vorliegt */
const EMPTY_VIEW: EndorsementView = {
  usable: [],
  dropped: [],
  hasCtr: false,
  commonRestrictions: [],
  familiarizations: [],
  ctrPositions: [],
  airportSolos: [],
};

export function buildEndorsementView(
  entry: SignupTableEntry | null | undefined,
  eventAirports: string[]
): EndorsementView {
  if (!entry) return EMPTY_VIEW;

  const states: AirportState[] = eventAirports.map((airport) => {
    const data = endorsementFor(entry, airport);
    const excluded = isAirportExcluded(entry, airport);
    const levels = levelsFor(entry, airport);
    const restrictions = (data?.restrictions ?? []).filter(Boolean);
    return {
      airport,
      excluded,
      levels,
      ctr: !excluded && (data?.allowedLevels ?? []).includes("CTR"),
      restrictions,
      key: excluded ? "×" : `${levels.join("/")}|${restrictions.join(";")}`,
    };
  });

  // Einschränkungen, die überall gleich lauten, hängen nicht am Platz – sie
  // einmal je Airport zu wiederholen füllt die Zeile, ohne etwas zu sagen.
  const commonRestrictions =
    states.length > 1
      ? states[0].restrictions.filter((r) => states.every((s) => s.restrictions.includes(r)))
      : [];

  // Die Center-Angaben stehen in jeder Airport-Freigabe gleich; eine genügt.
  const anyData =
    eventAirports.map((a) => endorsementFor(entry, a)).find(Boolean) ??
    entry.endorsement ??
    undefined;

  const solos = anyData?.soloPositions ?? [];
  const soloSectors = new Set(familiarizationsFromPositions(solos));
  const soloByCallsign = new Map(
    solos
      .map((p) => p.split("_"))
      .filter((parts) => parts.length === 3 && parts[2] === "CTR")
      .map((parts) => [parts[1], parts.join("_")] as const)
  );

  const sectors = new Set([...(anyData?.familiarizations ?? []).map((f) => f.toUpperCase())]);
  for (const s of soloSectors) sectors.add(s);

  const familiarizations: FamiliarizationView[] = [...sectors]
    .sort()
    .map((sector) => ({
      sector,
      fromSolo: soloSectors.has(sector),
      position: soloByCallsign.get(sector),
    }));

  // Positionen, die über den Sektor hinaus etwas sagen. Ein Solo auf
  // EDMM_STA_CTR steht schon als Sektor STA in der Liste – es hier noch einmal
  // als Position zu führen, wäre dieselbe Aussage zweimal.
  const ctrEndorsements = anyData?.ctrEndorsements ?? [];
  const ctrSolos = solos.filter((p) => p.endsWith("_CTR"));
  const ctrPositions = [
    ...ctrEndorsements.map((callsign) => ({ callsign, fromSolo: false })),
    ...ctrSolos
      .filter((c) => !ctrEndorsements.includes(c))
      .map((callsign) => ({ callsign, fromSolo: true })),
  ]
    .filter(({ callsign }) => {
      const parts = callsign.split("_");
      return !(parts.length === 3 && sectors.has(parts[1]));
    })
    .sort((a, b) => a.callsign.localeCompare(b.callsign));

  return {
    usable: states.filter((s) => !s.excluded && s.levels.length > 0),
    dropped: states.filter((s) => s.excluded || s.levels.length === 0),
    hasCtr: states.some((s) => s.ctr),
    commonRestrictions,
    familiarizations,
    ctrPositions,
    airportSolos: solos.filter((p) => !p.endsWith("_CTR")),
  };
}

/** Warum fällt dieser Airport aus der Liste? */
export function dropReason(state: AirportState): string {
  if (state.excluded) return "abgewählt";
  if (state.ctr) return "nur Center";
  return "keine Freigabe";
}
