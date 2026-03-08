import { RuleInput, RuleResult } from '../types';

/**
 * AFIS / T2 Endorsement Rule.
 * If the airport requires an AFIS endorsement (gcapStatus === "AFIS"), the user must hold
 * a corresponding T2/AFIS endorsement.
 * Currently uses mock data (t2AfisEndorsements is always empty) – the rule is permissive
 * until real T2 API data is available, adding a restriction note instead of blocking.
 *
 * TODO: once real T2 endpoint is available, change this to return { allowed: false } when
 * the endorsement is missing and remove the mock-pass behaviour.
 */
export function afisRule(input: RuleInput): RuleResult {
  const { policy, data } = input;

  if (!policy.requiresAfis) {
    return { allowed: true };
  }

  // Mock: t2AfisEndorsements is always empty for now – allow with restriction note
  const hasAfis = data.t2AfisEndorsements.length > 0;
  if (!hasAfis) {
    // Permissive mock: allow but flag that AFIS data is not verified yet
    return { allowed: true, restriction: 'AFIS Endorsement (nicht verifiziert)' };
  }

  return { allowed: true };
}
