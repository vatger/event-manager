export type EndoTrainingResponse = {
  success: boolean;
  data: Endorsement[];
};

type Endorsement = {
  id: number;
  user_cid: number;
  instructor_cid: number;
  position: string;
  facility: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};

export type SoloTrainingResponse = {
  success: boolean;
  data: Solo[];
};

type Solo = {
  id: number;
  user_cid: number;
  instructor_cid: number;
  position: string;
  expiry: string; // ISO timestamp
  max_days: number;
  facility: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  position_days: number;
};

  export interface FamiliarizationData {
    cid: number;
    familiarizations: {
      [fir: string]: string[]; // Array von erlaubten Airspace-Gruppen
    };
  }

  export interface EndorsementQueryParams {
    user: { 
      userCID: number,
      rating: number
    }
    event: { 
      airport: string,
      fir?: string 
    }
  }

  export interface EndorsementResponse {
    group: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
    restrictions: string[];
    endorsements: string[];
    familiarizations: string[];
    data?: EndorsementSoloFamsData
  }
  
  export interface EndorsementSoloFamsData {
    endorsement: string[],
    solos: string[],
    fams?: string[]
  }
  
  export interface ControllerGroup {
    group: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
    restrictions: string[];
    data?: EndorsementSoloFamsData
  }
  
  export interface EventData {
    id: string;
    fir: string;
    airport: string;
    isTier1: boolean;
  }

  // Multi-Airport Support
  export interface MultiAirportEndorsementQueryParams {
    user: { 
      userCID: number,
      rating: number
    }
    event: { 
      airports: string[],
      fir?: string 
    }
  }

  export interface AirportEndorsementResult {
    airport: string;
    canControl: boolean;
    group: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
    restrictions: string[];
  }

  export interface MultiAirportEndorsementResponse {
    airports: AirportEndorsementResult[];
    highestGroup: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
    endorsements: string[];
    familiarizations: string[];
  }