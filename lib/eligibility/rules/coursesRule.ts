import { RuleInput, RuleResult } from '../types';

/**
 * Required Courses Rule.
 * If any mandatory courses for the requested level have not been completed by the user,
 * a restriction string is added (but the level is NOT blocked).
 * This matches the soft-enforcement policy: the controller may still be assigned,
 * but the roster editor sees the outstanding test as a restriction.
 */
export function coursesRule(input: RuleInput): RuleResult {
  const { level, data } = input;

  const missing = data.missingCourses[level] ?? [];
  if (missing.length > 0) {
    return {
      allowed: true,
      restriction: `Test nicht abgeschlossen: ${missing.join(', ')}`,
    };
  }

  return { allowed: true };
}
