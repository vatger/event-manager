export type EndoTrainingResponse = {
  success: boolean;
  data: Endorsement[];
};

type Endorsement = {
  id: number;
  userCid: number;
  position: string;
  facility: number;
  createdAt: string; // ISO timestamp
};

export type SoloTrainingResponse = {
  success: boolean;
  data: Solo[];
};

type Solo = {
  id: number;
  userCid: number;
  position: string;
  facility: number;
  mentor: number;
  positionDays: number;
  expireAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp
};
export type FamiliarizationResponse = {
  success: boolean;
  data: Familiarization[];
}

type Familiarization = {
  vatsim_id: string;
  sector: string;
  fir: string;
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
    /**
     * Alle tatsächlich freigegebenen Ebenen – die Rangfolge sagt nichts
     * darüber aus, ob die darunterliegenden mit abgedeckt sind.
     */
    allowedLevels: ('DEL' | 'GND' | 'TWR' | 'APP' | 'CTR')[];
    restrictions: string[];
    /** Human-readable reason why group is null (e.g. "nicht im Roster") */
    blockReason?: string;
    endorsements: string[];
    familiarizations: string[];
    data?: EndorsementSoloFamsData
  }
  
  export interface EndorsementSoloFamsData {
    endorsement: string[],
    solos: string[],
    fams?: string[]
  }