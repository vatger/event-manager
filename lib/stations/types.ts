export type StationGroup = "DEL" | "GND" | "TWR" | "APP" | "CTR";

export interface Station {
  callsign: string;
  group: StationGroup;
  airport?: string; // wenn undefined -> FIR-weit gültig
}
