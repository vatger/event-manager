/**
 * FIR Station Configuration
 * 
 * Defines which stations belong to each FIR (Flight Information Region).
 * This configuration is used to filter and display CPTs relevant to each FIR.
 */

export interface FIRStation {
  callsign: string;
  name: string;
  type: 'TWR' | 'APP' | 'CTR' | 'FSS';
}

export interface FIRConfig {
  code: string;
  name: string;
  fullName: string;
  stations: FIRStation[];
}

export const FIR_STATIONS: Record<string, FIRConfig> = {
  EDGG: {
    code: 'EDGG',
    name: 'Langen',
    fullName: 'Langen FIR',
    stations: [
      // Frankfurt
      { callsign: 'EDDF_TWR', name: 'Frankfurt Tower', type: 'TWR' },
      { callsign: 'EDDF_APP', name: 'Frankfurt Approach', type: 'APP' },
      // Köln/Bonn
      { callsign: 'EDDK_TWR', name: 'Köln/Bonn Tower', type: 'TWR' },
      { callsign: 'EDDK_APP', name: 'Köln/Bonn Approach', type: 'APP' },
      // Stuttgart
      { callsign: 'EDDS_TWR', name: 'Stuttgart Tower', type: 'TWR' },
      { callsign: 'EDDS_APP', name: 'Stuttgart Approach', type: 'APP' },
      // Düsseldorf
      { callsign: 'EDDL_TWR', name: 'Düsseldorf Tower', type: 'TWR' },
      { callsign: 'EDDL_APP', name: 'Düsseldorf Approach', type: 'APP' },
    ],
  },
  EDWW: {
    code: 'EDWW',
    name: 'Bremen',
    fullName: 'Bremen FIR',
    stations: [
      // Hamburg
      { callsign: 'EDDH_TWR', name: 'Hamburg Tower', type: 'TWR' },
      { callsign: 'EDDH_APP', name: 'Hamburg Approach', type: 'APP' },
      // Berlin
      { callsign: 'EDDB_TWR', name: 'Berlin Brandenburg Tower', type: 'TWR' },
      { callsign: 'EDDB_APP', name: 'Berlin Approach', type: 'APP' },
      // Hannover
      { callsign: 'EDDV_TWR', name: 'Hannover Tower', type: 'TWR' },
      { callsign: 'EDDV_APP', name: 'Hannover Approach', type: 'APP' },
    ],
  },
  EDMM: {
    code: 'EDMM',
    name: 'München',
    fullName: 'München FIR',
    stations: [
      // München
      { callsign: 'EDDM_TWR', name: 'München Tower', type: 'TWR' },
      { callsign: 'EDDM_APP', name: 'München Approach', type: 'APP' },
      // Nürnberg
      { callsign: 'EDDN_TWR', name: 'Nürnberg Tower', type: 'TWR' },
      { callsign: 'EDDN_APP', name: 'Nürnberg Approach', type: 'APP' },
      // Leipzig/Halle
      { callsign: 'EDDP_TWR', name: 'Leipzig Tower', type: 'TWR' },
      { callsign: 'EDDP_APP', name: 'Leipzig Approach', type: 'APP' },
    ],
  },
};

/**
 * Get all stations for a specific FIR
 */
export function getStationsForFIR(firCode: string): FIRStation[] {
  return FIR_STATIONS[firCode]?.stations || [];
}

/**
 * Get FIR configuration by code
 */
export function getFIRConfig(firCode: string): FIRConfig | undefined {
  return FIR_STATIONS[firCode];
}

/**
 * Get all FIR codes
 */
export function getAllFIRCodes(): string[] {
  return Object.keys(FIR_STATIONS);
}

/**
 * Check if a station belongs to a specific FIR
 * Matches based on the first 4 characters (airport ICAO code) of the callsign
 */
export function isStationInFIR(stationCallsign: string, firCode: string): boolean {
  const stations = getStationsForFIR(firCode);
  // Extract the first 4 characters (airport code) from the station callsign
  const airportCode = stationCallsign.substring(0, 4);
  return stations.some(station => station.callsign.startsWith(airportCode));
}
