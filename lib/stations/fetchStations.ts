import { Station, StationGroup } from "./types";
import { stationOverrides } from "./stationOverrides";

let cachedStations: Station[] | null = null;

interface DataHubStation {
  logon: string,
  frequency: string,
  abbreviation: string,
  description: string,
  gcap_status: string,
  s1_twr: boolean,
  s1_theory: boolean
}
// Gruppe anhand des Callsigns bestimmen
function inferGroupFromLogon(logon: string): StationGroup | undefined {
  if (logon.endsWith("_DEL")) return "DEL";
  if (logon.endsWith("_GND")) return "GND";
  if (logon.endsWith("_TWR")) return "TWR";
  if (logon.endsWith("_APP")) return "APP";
  if (logon.endsWith("_CTR")) return "CTR";
  return undefined;
}

// Hauptfunktion: Holt alle Stationen
export async function fetchAllStations(): Promise<Station[]> {
  if (cachedStations) return cachedStations;

  const res = await fetch("https://raw.githubusercontent.com/VATGER-Nav/datahub/production/api/stations.json");
  if (!res.ok) throw new Error("Failed to fetch station data from Datahub");

  const data = await res.json();

  const stations: Station[] = data
    .map((entry: DataHubStation) => {
      const callsign: string = entry.logon;
      const airport = /^[A-Z]{4}/.test(callsign) ? callsign.substring(0, 4) : undefined;
      let group = inferGroupFromLogon(callsign);

      // Spezialfälle überschreiben
      if (stationOverrides[callsign]?.group) {
        group = stationOverrides[callsign].group!;
      }

      // Nur bekannte Gruppen behalten
      if (!group) return null;

      // Extract S1 TWR flag from datahub
      const s1Twr = entry.s1_twr === true ? true : undefined;

      return { callsign, group, airport, s1Twr, gcapStatus: entry.gcap_status };
    })
    .filter((s: Station | null): s is Station => s !== null);

  cachedStations = stations;
  return stations;
}

// Funktion: Stationen für einen bestimmten Airport holen
export async function fetchStationsByAirport(icao: string): Promise<Station[]> {
  const allStations = await fetchAllStations();
  return allStations.filter((s) => s.airport === icao);
}

// Funktion: Prüft ob ein Airport ein Tier-1 Airport ist (gcap_status === "1" an der TWR-Station)
// Nutzt den vorhandenen Stations-Cache aus fetchAllStations.
export async function isAirportTier1(airport: string): Promise<boolean> {
  const allStations = await fetchAllStations();
  const icao = airport.toUpperCase();
  return allStations.some(
    (s) => s.group === "TWR" && s.airport === icao && s.gcapStatus === "1"
  );
}
