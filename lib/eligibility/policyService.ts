import { fetchAllStations } from '@/lib/stations/fetchStations';
import { AirportLevel, AirportPolicy } from './types';

/**
 * Build an AirportPolicy from datahub station metadata.
 * Tier1 airports (gcapStatus === "1" on TWR) require a T1 endorsement from TWR level onwards.
 * AFIS airports (gcapStatus === "AFIS" on the TWR/AFIS station) require a T2/AFIS endorsement.
 * S1-TWR airports (s1_twr flag) allow the TWR station to be staffed with GND-level rating.
 */
export async function buildAirportPolicy(airport: string, fir?: string): Promise<AirportPolicy> {
  const allStations = await fetchAllStations();
  const icao = airport.toUpperCase();
  const airportStations = allStations.filter((s) => s.airport === icao);

  const twr = airportStations.find((s) => s.group === 'TWR');

  const isTier1 = airportStations.some((s) => s.group === 'TWR' && s.gcapStatus === '1');
  const requiresAfis = airportStations.some(
    (s) => (s.group === 'TWR' || s.group === 'GND') && s.gcapStatus === 'AFIS'
  );
  const s1TwrAllowed = twr?.s1Twr === true;

  const tier1RequiredFrom: AirportLevel | undefined = isTier1 ? 'TWR' : undefined;

  return {
    airport: icao,
    fir,
    isTier1,
    tier1RequiredFrom,
    requiresAfis,
    s1TwrAllowed,
  };
}
