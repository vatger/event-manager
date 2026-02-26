export type StationGroup = "DEL" | "GND" | "TWR" | "APP" | "CTR" | "Sonstiges";

export interface Station {
  callsign: string;
  group: StationGroup;
  airport?: string; // wenn undefined -> FIR-weit gültig
  s1Twr?: boolean; // true if this TWR station can be staffed with S1 (GND endorsement)
  gcapStatus?: string; // gcap_status from Datahub: "0" | "1" | "AFIS" | "MIL TWR" | "MIL APP"
}
