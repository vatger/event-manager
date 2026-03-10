import { RuleInput, RuleResult, levelRank } from '../types';

/**
 * S1-Theory Gatekeeper Rule.
 * If the user is on the S1-theory-only roster and the airport has no s1TheoryMaxLevel policy
 * (or the requested level exceeds it), the level is blocked.
 * Currently uses mock data (isS1TheoryOnly is always false) – replace when real API is available.
 */
export function s1TheoryRule(input: RuleInput): RuleResult {
  const { data, policy, level } = input;

  if (!data.isS1TheoryOnly) {
    return { allowed: true };
  }

  if (!policy.s1TheoryMaxLevel) {
    return { allowed: false, blockReason: 'S1 Theory only – kein Zugang zu diesem Airport' };
  }

  if (levelRank(level) > levelRank(policy.s1TheoryMaxLevel)) {
    return {
      allowed: false,
      blockReason: `S1 Theory only – max. ${policy.s1TheoryMaxLevel}`,
    };
  }

  return { allowed: true };
}
