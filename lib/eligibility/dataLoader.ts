import {
  getCachedUserEndorsements,
  getCachedUserFamiliarizations,
  getCachedUserSolos,
} from '@/lib/training/cacheService';
import { EndorsementService } from '@/lib/endorsements/endorsementService';
import { AirportLevel, AirportPolicy, EligibilityData, LEVEL_ORDER } from './types';
import { getIncompleteCourseNames } from './courseService';

/**
 * Load all data needed by the eligibility engine.
 * Real data: T1 endorsements, solos, familiarizations (from training cache), required courses.
 * Mock data: roster membership, S1-theory-only status, T2/AFIS endorsements.
 * The mock APIs will be replaced once real endpoints are available.
 */
export async function loadEligibilityData(
  userCID: number,
  policy: AirportPolicy
): Promise<EligibilityData> {
  const [allEndorsements, rawSolos, rawFams] = await Promise.all([
    getCachedUserEndorsements(userCID),
    getCachedUserSolos(userCID),
    getCachedUserFamiliarizations(userCID),
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

  // --- Mock APIs (to be replaced with real endpoints) ---

  // Mock: user is always considered to be on the roster
  const isOnRoster = true;

  // Mock: no user is on the S1-theory-only roster
  const isS1TheoryOnly = false;

  // Mock: no T2/AFIS endorsements available yet
  const t2AfisEndorsements: string[] = [];

  // Required courses: fetch from VATGER-ATD GitHub and check moodle completion per level.
  // Callsign for DEL/GND/TWR/APP is "${airport}_${level}"; for CTR use "${fir}_CTR".
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
