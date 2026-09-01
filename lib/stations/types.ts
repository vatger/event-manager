export type StationGroup = "DEL" | "GND" | "TWR" | "APP" | "CTR" | "Sonstiges";

export interface Station {
  callsign: string;
  group: StationGroup;
  airport?: string; // wenn undefined -> FIR-weit gültig
  abbreviation?: string; // Kürzel aus dem Datahub, z. B. "DMC" für EDDM_DEL
  s1Twr?: boolean; // true if this TWR station can be staffed with S1 (GND endorsement)
  s1Theory?: boolean; // true if this station can be staffed by S1-theory-only controllers
  gcapStatus?: string; // gcap_status from Datahub: "0" | "1" | "AFIS" | "MIL TWR" | "MIL APP"
  /**
   * Nötige Familiarisierungen, aus `required_familiarisations` des Datahubs.
   *
   * Aussen stehen Alternativen (eine davon genügt), innen die Kürzel, die
   * dafür zusammen vorliegen müssen. `["CH+SH"]` wird damit zu `[["CH","SH"]]`
   * und `["STA","WLD"]` zu `[["STA"],["WLD"]]`. Fehlt das Feld, macht der
   * Datahub keine Vorgabe – dann wird auch nicht geprüft.
   */
  requiredFamiliarizations?: string[][];
}
