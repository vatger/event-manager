import { StationGroup } from "./types";

export const stationOverrides: Record<string, Partial<{ group: StationGroup }>> = {
  "EDDM_N_GND": { group: "TWR" },
  "EDDM_S_GND": { group: "TWR" },
};
