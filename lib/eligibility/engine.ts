import {
  AirportLevel,
  EligibilityData,
  EligibilityResult,
  AirportPolicy,
  LevelEvaluation,
  LEVEL_ORDER,
  RuleInput,
  RuleResult,
} from './types';
import { EndorsementService } from '@/lib/endorsements/endorsementService';
import { rosterRule } from './rules/rosterRule';
import { s1TheoryRule } from './rules/s1TheoryRule';
import { ratingRule } from './rules/ratingRule';
import { soloRule } from './rules/soloRule';
import { tier1Rule } from './rules/tier1Rule';
import { afisRule } from './rules/afisRule';
import { coursesRule } from './rules/coursesRule';
import { familiarizationRule } from './rules/familiarizationRule';

type Rule = (input: RuleInput) => RuleResult;

/**
 * Ordered list of gatekeeper rules applied first.
 * If any gatekeeper blocks, all levels are denied immediately.
 */
const GATEKEEPER_RULES: Rule[] = [rosterRule, s1TheoryRule];

/**
 * Per-level rules applied after the rating/solo gate.
 * Each rule can block a level or add a restriction string.
 * ratingRule and soloRule are handled separately (OR logic), not included here.
 */
const PER_LEVEL_RULES: Rule[] = [tier1Rule, afisRule, coursesRule, familiarizationRule];

/**
 * Evaluates whether a single level is reachable.
 * Returns the set of restrictions that apply if the level is granted.
 */
function evaluateLevel(
  level: AirportLevel,
  user: { userCID: number; rating: number },
  policy: AirportPolicy,
  data: EligibilityData
): { allowed: boolean; restrictions: string[]; blockReasons: string[] } {
  const input: RuleInput = { level, user, policy, data };
  const restrictions: string[] = [];
  const blockReasons: string[] = [];

  // --- Rating / Solo gate ---
  // The level is accessible if the rating is sufficient OR a solo covers it.
  const ratingResult = ratingRule(input);
  const soloResult = soloRule(input);

  const ratingOk = ratingResult.allowed;
  const soloOk = soloResult.allowed;

  if (!ratingOk && !soloOk) {
    // Neither rating nor solo qualifies – collect block reasons from both
    if (ratingResult.blockReason) blockReasons.push(ratingResult.blockReason);
    if (soloResult.blockReason) blockReasons.push(soloResult.blockReason);
    return { allowed: false, restrictions, blockReasons };
  }

  // If solo is the reason for access, add the solo restriction
  if (!ratingOk && soloOk && soloResult.restriction) {
    restrictions.push(soloResult.restriction);
  }

  // --- Additional per-level rules ---
  for (const rule of PER_LEVEL_RULES) {
    const result = rule(input);
    if (!result.allowed) {
      if (result.blockReason) blockReasons.push(result.blockReason);
      return { allowed: false, restrictions, blockReasons };
    }
    if (result.restriction) {
      restrictions.push(result.restriction);
    }
  }

  return { allowed: true, restrictions, blockReasons: [] };
}

export class EligibilityEngine {
  /**
   * Evaluate the maximum allowed level for a user at a given airport.
   *
   * @param user    - CID and numeric VATSIM rating value
   * @param policy  - Airport policy (tier1, AFIS, s1Twr, etc.)
   * @param data    - Pre-loaded training + mock roster/course data
   * @returns EligibilityResult with maxAllowedGroup, restrictions, and per-level debug info
   */
  static evaluate(
    user: { userCID: number; rating: number },
    policy: AirportPolicy,
    data: EligibilityData
  ): EligibilityResult {
    const input0: RuleInput = { level: 'GND', user, policy, data };

    // --- Gatekeeper rules: block everything if failed ---
    for (const rule of GATEKEEPER_RULES) {
      const result = rule(input0);
      if (!result.allowed) {
        const allLevels: LevelEvaluation[] = LEVEL_ORDER.map((l) => ({
          level: l,
          allowed: false,
          restrictions: [],
          blockReasons: [result.blockReason ?? 'gatekeeper'],
        }));
        return { maxAllowedGroup: null, restrictions: [], reasonsPerLevel: allLevels };
      }
    }

    // --- Per-level evaluation ---
    const evaluations: LevelEvaluation[] = [];

    for (const level of LEVEL_ORDER) {
      const { allowed, restrictions, blockReasons } = evaluateLevel(level, user, policy, data);
      evaluations.push({ level, allowed, restrictions, blockReasons });
    }

    // --- Determine max allowed group ---
    // The existing API only exposes GND/TWR/APP/CTR/null (DEL is tracked internally)
    const GROUP_LEVELS: AirportLevel[] = ['GND', 'TWR', 'APP', 'CTR'];
    let maxAllowedGroup: 'GND' | 'TWR' | 'APP' | 'CTR' | null = null;

    for (const level of GROUP_LEVELS) {
      const ev = evaluations.find((e) => e.level === level);
      if (ev?.allowed) {
        maxAllowedGroup = level as 'GND' | 'TWR' | 'APP' | 'CTR';
      }
    }

    // Collect restrictions from the winning level
    const winnerEval = evaluations.find((e) => e.level === maxAllowedGroup);
    const restrictions: string[] = winnerEval?.restrictions ?? [];

    // For tier1 airports: if CTR is allowed but no APP endorsement exists, add "no APP"
    if (
      maxAllowedGroup === 'CTR' &&
      !data.allEndorsements.some(
        (e) => EndorsementService.extractGroupFromEndorsement(e) === 'APP'
      )
    ) {
      restrictions.push('no APP');
    }

    return { maxAllowedGroup, restrictions, reasonsPerLevel: evaluations };
  }
}
