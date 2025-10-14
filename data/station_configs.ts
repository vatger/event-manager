export type StationGroup = "DEL" | "GND" | "TWR" | "APP" | "CTR";

export interface Station {
  callsign: string;
  group: StationGroup;
  airport?: string; // wenn undefined -> FIR-weit gültig
}

export const stationsConfig: Station[] = [
  // EDDM Delivery
  { callsign: "EDDM_DEL", group: "GND", airport: "EDDM" },
  { callsign: "EDDM_C_DEL", group: "GND", airport: "EDDM" },

  // EDDM Ground
  { callsign: "EDDM_1_GND", group: "GND", airport: "EDDM" },
  { callsign: "EDDM_2_GND", group: "GND", airport: "EDDM" },
  { callsign: "EDDM_3_GND", group: "GND", airport: "EDDM" },
  { callsign: "EDDM_N_GND", group: "TWR", airport: "EDDM" },
  { callsign: "EDDM_S_GND", group: "TWR", airport: "EDDM" },

  // EDDM Tower
  { callsign: "EDDM_N_TWR", group: "TWR", airport: "EDDM" },
  { callsign: "EDDM_S_TWR", group: "TWR", airport: "EDDM" },

  // EDDM Approach
  { callsign: "EDDM_NH_APP", group: "APP", airport: "EDDM" },
  { callsign: "EDDM_SH_APP", group: "APP", airport: "EDDM" },
  { callsign: "EDDM_NL_APP", group: "APP", airport: "EDDM" },
  { callsign: "EDDM_SL_APP", group: "APP", airport: "EDDM" },
  { callsign: "EDDM_ND_APP", group: "APP", airport: "EDDM" },
  { callsign: "EDDM_SD_APP", group: "APP", airport: "EDDM" },

  // CTR (FIR-weit)
  { callsign: "EDMM_ALB_CTR", group: "CTR" },
  { callsign: "EDMM_BBG_CTR", group: "CTR" },
  { callsign: "EDMM_EGG_CTR", group: "CTR" },
  { callsign: "EDMM_FUE_CTR", group: "CTR" },
  { callsign: "EDMM_GER_CTR", group: "CTR" },
  { callsign: "EDMM_HAL_CTR", group: "CTR" },
  { callsign: "EDMM_MEI_CTR", group: "CTR" },
  { callsign: "EDMM_NDG_CTR", group: "CTR" },
  { callsign: "EDMM_HOF_CTR", group: "CTR" },
  { callsign: "EDMM_RDG_CTR", group: "CTR" },
  { callsign: "EDMM_STA_CTR", group: "CTR" },
  { callsign: "EDMM_TEG_CTR", group: "CTR" },
  { callsign: "EDMM_TRU_CTR", group: "CTR" },
  { callsign: "EDMM_WLD_CTR", group: "CTR" },
  { callsign: "EDMM_ZUG_CTR", group: "CTR" },
  { callsign: "EDMM_SWA_CTR", group: "CTR" },

  // EDDP 
  { callsign: "EDDP_DEL", group: "GND", airport: "EDDP" },
  { callsign: "EDDP_GND", group: "GND", airport: "EDDP" },
  { callsign: "EDDP_N_TWR", group: "TWR", airport: "EDDP" },
  { callsign: "EDDP_S_TWR", group: "TWR", airport: "EDDP" },
  { callsign: "EDDP_TRN_APP", group: "APP", airport: "EDDP" },
  { callsign: "EDDP_TRS_APP", group: "APP", airport: "EDDP" },
  { callsign: "EDDP_ND_APP", group: "APP", airport: "EDDP" },
  { callsign: "EDDP_SD_APP", group: "APP", airport: "EDDP" },

  // EDDN
  { callsign: "EDDN_GND", group: "GND", airport: "EDDN" },
  { callsign: "EDDN_TWR", group: "TWR", airport: "EDDN" },
  { callsign: "EDDN_FRK_APP", group: "APP", airport: "EDDN" },
  { callsign: "EDDN_D_APP", group: "APP", airport: "EDDN" },

  //EDDC
  { callsign: "EDDC_GND", group: "GND", airport: "EDDC" },
  { callsign: "EDDC_A_GND", group: "GND", airport: "EDDC" },
  { callsign: "EDDC_TWR", group: "TWR", airport: "EDDC" },
  { callsign: "EDDC_SAS_APP", group: "APP", airport: "EDDC" },

  //EDJA
  { callsign: "EDJA_GND", group: "GND", airport: "EDJA" },
  { callsign: "EDJA_TWR", group: "TWR", airport: "EDJA" },
  { callsign: "EDJA_ILR_APP", group: "APP", airport: "EDJA" },
];
