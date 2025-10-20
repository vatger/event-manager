import { FamiliarizationData } from "./types";

// Mock APIs - später durch echte VATSIM APIs ersetzen
export const mockEndorsementsAPI = async (cid: number): Promise<string[]> => {
    // Ihre Mock-Implementierung
    return ["EDDM_GNDDEL", "EDDM_TWR"];
  };
  
  export const mockFamiliarizationsAPI = async (cid: number): Promise<FamiliarizationData> => {
    // Ihre Mock-Implementierung
    return {
      cid,
      familiarizations: {
        'EDGG': ['EDGG_N', 'EDGG_S'],
        'EDMM': ['STA', "ALB", "HOF"]
      }
    };
  };