export interface EndorsementData {
    cid: number;
    endorsements: string[];
  }
  
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