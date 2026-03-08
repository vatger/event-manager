import {
  getCachedUserEndorsements,
  getCachedUserFamiliarizations,
  getCachedUserSolos,
} from '@/lib/training/cacheService';
import { EndorsementService } from '@/lib/endorsements/endorsementService';
import { AirportPolicy, EligibilityData } from './types';

/**
 * Load all data needed by the eligibility engine.
 * Real data: T1 endorsements, solos, familiarizations (from training cache).
 * Mock data: roster membership, S1-theory-only status, T2/AFIS endorsements, missing courses.
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

  // Mock: no missing required courses
  const missingCourses = {};

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
