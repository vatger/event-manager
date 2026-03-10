import { fetchAllStations } from '@/lib/stations/fetchStations';
import { AirportLevel, AirportPolicy, LEVEL_ORDER } from './types';

const REVERSED_LEVEL_ORDER = [...LEVEL_ORDER].reverse();

/**
 * Build an AirportPolicy from datahub station metadata.
 *
 * tier1RequiredFrom: the lowest ATC level whose datahub station carries gcapStatus === "1".
 *   - "Full T1" airports (gcapStatus "1" on DEL, GND, …) → tier1RequiredFrom = "DEL"
 *   - Standard T1 airports (gcapStatus "1" only on TWR) → tier1RequiredFrom = "TWR"
 *   - Non-T1 airports → tier1RequiredFrom = undefined
 *
 * AFIS airports (gcapStatus === "AFIS" on the TWR/GND station) require a T2/AFIS endorsement.
 * S1-TWR airports (s1_twr flag) allow the TWR station to be staffed with GND-level rating.
 * S1-Theory airports (s1_theory flag on a station) allow S1-theory-only controllers to staff up
 * to the highest level that carries the s1_theory flag.
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

  // Determine the lowest level that carries gcapStatus === "1" so that "full T1" airports
  // (where e.g. DEL/GND also have gcapStatus "1") are handled correctly.
  let tier1RequiredFrom: AirportLevel | undefined;
  if (isTier1) {
    const gcap1Groups = new Set(
      airportStations
        .filter((s) => s.gcapStatus === '1')
        .map((s) => s.group)
    );
    for (const level of LEVEL_ORDER) {
      if (gcap1Groups.has(level)) {
        tier1RequiredFrom = level;
        break;
      }
    }
    // Fallback: should not happen if isTier1 is true, but guard anyway
    if (!tier1RequiredFrom) tier1RequiredFrom = 'TWR';
  }

  // Determine the highest level accessible by S1-theory-only controllers.
  // A station with s1_theory === true in the datahub signals that the level can be staffed
  // without a full rating – only the S1 theory exam is required.
  let s1TheoryMaxLevel: AirportLevel | undefined;
  const s1TheoryGroups = new Set(
    airportStations.filter((s) => s.s1Theory === true).map((s) => s.group)
  );
  for (const level of REVERSED_LEVEL_ORDER) {
    if (s1TheoryGroups.has(level)) {
      s1TheoryMaxLevel = level;
      break;
    }
  }

  return {
    airport: icao,
    fir,
    isTier1,
    tier1RequiredFrom,
    requiresAfis,
    s1TwrAllowed,
    s1TheoryMaxLevel,
  };
}
