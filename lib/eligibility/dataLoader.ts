import {
  getCachedUserEndorsements,
  getCachedUserFamiliarizations,
  getCachedUserSolos,
} from '@/lib/training/cacheService';
import { EndorsementService } from '@/lib/endorsements/endorsementService';
import { AirportLevel, AirportPolicy, EligibilityData, LEVEL_ORDER } from './types';
import { getIncompleteCourseNames } from './courseService';
import { isS1TheoryOnly as loadS1TheoryOnly } from '@/lib/training/s1TheoryRoster';

/**
 * Load all data needed by the eligibility engine.
 * Real data: T1 endorsements, solos, familiarizations (from training cache), required courses,
 * S1-theory roster (from the S1 signup).
 * The mock APIs will be replaced once real endpoints are available.
 */
export async function loadEligibilityData(
  userCID: number,
  rating: number,
  policy: AirportPolicy
): Promise<EligibilityData> {
  const [allEndorsements, rawSolos, rawFams, isS1TheoryOnly] = await Promise.all([
    getCachedUserEndorsements(userCID),
    getCachedUserSolos(userCID),
    getCachedUserFamiliarizations(userCID),
    // Theory Roster aus der S1-Anmeldung (siehe lib/training/s1TheoryRoster)
    loadS1TheoryOnly(userCID, rating),
  ]);

  const endorsements = EndorsementService.getEndorsementsForAirport(
    allEndorsements,
    policy.airport,
    policy.fir
  );

  const relevantSoloPositions = EndorsementService.getEndorsementsForAirport(
    rawSolos.map((s) => s.position),
    policy.airport,
    policy.fir
  );

  const famsMap = (rawFams as { familiarizations: Record<string, string[]> }).familiarizations ?? {};
  const famsForFir: string[] = policy.fir ? (famsMap[policy.fir] ?? []) : [];

  // --- Mock APIs (wating for endpints of real data) ---

  // Mock: user is always considered to be on the roster
  const isOnRoster = true;

  // Mock: no T2/AFIS endorsements available yet
  const t2AfisEndorsements: string[] = [];

  // Required courses: fetch from VATGER Datahub and check moodle completion per level.
  // Callsign for DEL/GND/TWR/APP is "${airport}_${level}";
  const missingCourses: Partial<Record<AirportLevel, string[]>> = {};
  await Promise.all(
    LEVEL_ORDER.map(async (level) => {
      const callsign =`${policy.airport}_${level}`;
      const incomplete = await getIncompleteCourseNames(callsign, userCID);
      if (incomplete.length > 0) {
        missingCourses[level] = incomplete;
      }
    })
  );

  return {
    endorsements,
    allEndorsements,
    solos: rawSolos,
    relevantSoloPositions,
    famsForFir,
    isOnRoster,
    isS1TheoryOnly,
    t2AfisEndorsements,
    missingCourses,
  };
}
