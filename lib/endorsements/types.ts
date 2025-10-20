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
  
  export interface ControllerGroup {
    group: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
    remarks: string[];
    endorsements: string[];
  }
  
  export interface EventData {
    id: string;
    fir: string;
    airport: string;
    isTier1: boolean;
  }