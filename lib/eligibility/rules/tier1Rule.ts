import { AirportLevel, RuleInput, RuleResult, levelRank } from '../types';
import { EndorsementService } from '@/lib/endorsements/endorsementService';

/**
 * Tier1 (T1 Endorsement) Rule.
 * For airports where `policy.tier1RequiredFrom` is set (e.g. TWR for GCAP-tier1 airports),
 * the user must hold a matching T1 endorsement for the requested level.
 * A valid solo at or above the level acts as a substitute for the T1 endorsement.
 */
export function tier1Rule(input: RuleInput): RuleResult {
  const { level, policy, data } = input;

  if (!policy.tier1RequiredFrom) {
    // Airport does not require T1 endorsements – rule does not apply
    return { allowed: true };
  }

  if (levelRank(level) < levelRank(policy.tier1RequiredFrom)) {
    // Level is below the threshold where T1 is required
    return { allowed: true };
  }

  // Check if a valid T1 endorsement exists for this level
  const hasT1 = data.endorsements.some((e) =>
    EndorsementService.extractGroupFromEndorsement(e) === level
  );
  if (hasT1) {
    return { allowed: true };
  }

  // A solo can substitute for a T1 endorsement
  const hasSoloForLevel = data.relevantSoloPositions.some(
    (pos) => EndorsementService.extractGroupFromEndorsement(pos) === level
  );
  if (hasSoloForLevel) {
    return { allowed: true };
  }

  return {
    allowed: false,
    blockReason: `T1 Endorsement für ${level} fehlt`,
  };
}
