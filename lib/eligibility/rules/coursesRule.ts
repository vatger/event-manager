import { RuleInput, RuleResult } from '../types';

/**
 * Required Courses Rule.
 * If any mandatory courses are missing for the requested level, the level is blocked.
 * Currently uses mock data (missingCourses is always empty) – replace when real course
 * completion API is available.
 */
export function coursesRule(input: RuleInput): RuleResult {
  const { level, data } = input;

  const missing = data.missingCourses[level] ?? [];
  if (missing.length > 0) {
    return {
      allowed: false,
      blockReason: `Fehlende Kurse: ${missing.join(', ')}`,
    };
  }

  return { allowed: true };
}
