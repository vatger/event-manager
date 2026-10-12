import type { RosterController, StationMeta } from "@/lib/roster/rosterEligibility";
import type { PlanningInput } from "./types";

/** Block, wie ihn Editor und Anmeldungsseite kennen (Minuten seit Event-Start) */
export interface ExistingBlock {
  stationId: number | null;
  userCID: number | null;
  type: string;
  start: number;
  end: number;
}

/**
 * Planungseingabe aus dem Stand im Editor.
 *
 * `fill` lässt alles Bestehende stehen und plant nur in die Lücken.
 * `replace` plant die Controller-Schichten neu; Custom-Blöcke und
 * persönliche Blöcke ("Mentor") bleiben als feste Vorgabe.
 */
export function toPlanningInput(args: {
  stations: { id: number; callsign: string; sortOrder: number }[];
  stationMetaFor: (callsign: string) => StationMeta;
  controllers: RosterController[];
  blocks: ExistingBlock[];
  mode: "fill" | "replace";
  eventAirports: string[];
  totalMinutes: number;
  slotMinutes: number;
}): PlanningInput {
  const fixed = args.blocks
    .filter((b) => args.mode === "fill" || b.type !== "controller")
    .map((b) => ({ stationId: b.stationId, userCID: b.userCID, start: b.start, end: b.end }));
  return {
    stations: args.stations.map((s) => ({
      id: s.id,
      callsign: s.callsign,
      sortOrder: s.sortOrder,
      meta: args.stationMetaFor(s.callsign),
    })),
    controllers: args.controllers,
    fixed,
    eventAirports: args.eventAirports,
    totalMinutes: args.totalMinutes,
    slotMinutes: args.slotMinutes,
  };
}
