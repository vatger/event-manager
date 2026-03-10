import { AirportLevel, RuleInput, RuleResult } from '../types';

/** Minimum VATSIM rating value required per level (standard VATSIM rules) */
const MIN_RATING: Record<AirportLevel, number> = {
  DEL: 2, // S1
  GND: 2, // S1
  TWR: 3, // S2
  APP: 4, // S3
  CTR: 5, // C1
};

/**
 * Rating Rule.
 * Enforces minimum VATSIM rating per level.
 * Special case: if the airport's TWR station is flagged s1TwrAllowed, a GND-level rating
 * (S1, value 2) is sufficient for the TWR level.
 */
export function ratingRule(input: RuleInput): RuleResult {
  const { level, user, policy } = input;

  let required = MIN_RATING[level];
  let note = null
  // S1-TWR: some small airports allow S1 (GND group) controllers to staff TWR
  if (level === 'TWR' && policy.s1TwrAllowed) {
    required = MIN_RATING['GND']; // S1 is enoug
    if(user.rating == 2) note = "S1er"
  }

  if (user.rating < required) {
    const ratingNames: Record<number, string> = { 2: 'S1', 3: 'S2', 4: 'S3', 5: 'C1' };
    return {
      allowed: false,
      blockReason: `Rating zu niedrig – benötigt ${ratingNames[required] ?? required}`,
    };
  }

  return { allowed: true , restriction: note || ""};
}
