import { RuleInput, RuleResult } from '../types';

/**
 * Roster Gatekeeper Rule.
 * If the user is not on the active roster, all levels are blocked.
 * Currently uses mock data (always allows) – replace with real roster API when available.
 */
export function rosterRule(input: RuleInput): RuleResult {
  if (!input.data.isOnRoster) {
    return { allowed: false, blockReason: 'nicht im Roster' };
  }
  return { allowed: true };
}
