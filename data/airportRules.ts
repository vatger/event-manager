// airportRules.ts
export const airportRules = {
    EDDM: {
      tier: 1, // 1 = Tier-1, 0 = unrestricted
      areas: {
        GND: ["EDDM_2_GND", "EDDM_3_GND"],
        TWR: ["EDDM_N_GND", "EDDM_S_TWR", "EDDM_TWR"],
        APP: ["EDDM_APP", "EDDM_E_APP", "EDDM_W_APP"],
        CTR: ["MUN_CTR"]
      }
    },
    EDDF: {
      tier: 1,
      areas: {
        GND: ["EDDF_N_GND", "EDDF_S_GND"],
        TWR: ["EDDF_TWR"],
        APP: ["EDDF_APP"],
        CTR: ["FRA_CTR"]
      }
    },
    EDDN: {
      tier: 0,
      areas: {
        GND: ["EDDN_GND"],
        TWR: ["EDDN_TWR"],
        APP: ["EDDN_APP"],
        CTR: ["MUN_CTR"]
      }
    }
  };
  