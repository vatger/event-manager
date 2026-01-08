/* =========================
   VATSIM EVENTS (MyVATSIM)
   ========================= */

   export interface IVatsimEventResponse {
    data: IVatsimEvent[];
  }
  
  export interface IVatsimEvent {
    id: number;
    type: "Event";
    name: string;
    link: string;
  
    organisers: VatsimOrganiser[];
    airports: VatsimAirport[];
    routes: VatsimRoute[];
  
    start_time: string; // ISO UTC
    end_time: string;   // ISO UTC
  
    short_description: string;
    description: string;
  
    banner: string | null;
  }
  
  /* ===== Subtypes ===== */
  
  export interface VatsimOrganiser {
    region: string;
    division: string | null;
    subdivision: string | null;
    organised_by_vatsim: boolean;
  }
  
  export interface VatsimAirport {
    icao: string;
  }
  
  export interface VatsimRoute {
    departure: string;
    arrival: string;
    route: string;
  }
  
  /* =========================
     ATC BOOKINGS
     ========================= */
  
  export interface IAtcBooking {
    id: number;
    cid: number;
    type: "booking";
  
    callsign: string;
  
    start: string; // "YYYY-MM-DD HH:mm:ss"
    end: string;
  
    division: string;
    subdivision: string | null;
  }
  