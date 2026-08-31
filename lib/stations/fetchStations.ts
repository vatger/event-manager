import { Station, StationGroup } from "./types";
import { stationOverrides } from "./stationOverrides";
import { parseRequiredFamiliarizations } from "./familiarizations";

let cachedStations: Station[] | null = null;
let cachedAt = 0;
/**
 * Wie lange die Stationsliste wiederverwendet wird.
 *
 * Der Datahub führt inzwischen auch die nötigen Familiarisierungen; die ändern
 * sich mit den Sektorplänen. Ein Cache über die ganze Prozesslaufzeit würde
 * solche Änderungen bis zum nächsten Neustart verschlucken.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

interface DataHubStation {
  logon: string,
  frequency: string,
  abbreviation: string,
  description: string,
  gcap_status: string,
  s1_twr: boolean,
  s1_theory: boolean,
  /** Nötige Sektorkenntnis, z. B. ["CH+SH"] oder ["STA", "WLD"] */
  required_familiarisations?: string[]
}
// Gruppe anhand des Callsigns bestimmen.
// Departure zählt zur Approach-Ebene: Es gibt kein eigenes _DEP-Endorsement,
// wer APP freigegeben hat, darf auch Departure. Ohne diese Zuordnung fielen
// alle _DEP-Stationen unten aus der Liste – sie tauchten dann weder in der
// Stationsauswahl noch in der Freigabeprüfung auf.
function inferGroupFromLogon(logon: string): StationGroup | undefined {
  if (logon.endsWith("_DEL")) return "DEL";
  if (logon.endsWith("_GND")) return "GND";
  if (logon.endsWith("_TWR")) return "TWR";
  if (logon.endsWith("_APP") || logon.endsWith("_DEP")) return "APP";
  if (logon.endsWith("_CTR")) return "CTR";
  return undefined;
}

// Hauptfunktion: Holt alle Stationen
export async function fetchAllStations(): Promise<Station[]> {
  if (cachedStations && Date.now() - cachedAt < CACHE_TTL_MS) return cachedStations;

  let res: Response;
  try {
    res = await fetch(
      "https://raw.githubusercontent.com/VATGER-Nav/datahub/production/api/stations.json"
    );
  } catch (err) {
    // Ist der Datahub nicht erreichbar, ist eine alte Liste besser als keine:
    // Sonst stünde der Roster-Editor ohne jede Stationsangabe da.
    if (cachedStations) return cachedStations;
    throw err;
  }
  if (!res.ok) {
    if (cachedStations) return cachedStations;
    throw new Error("Failed to fetch station data from Datahub");
  }

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
      const s1Theory = entry.s1_theory === true ? true : undefined;

      return {
        callsign,
        group,
        airport,
        s1Twr,
        s1Theory,
        gcapStatus: entry.gcap_status,
        requiredFamiliarizations: parseRequiredFamiliarizations(
          entry.required_familiarisations
        ),
      };
    })
    .filter((s: Station | null): s is Station => s !== null);

  cachedStations = stations;
  cachedAt = Date.now();
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
