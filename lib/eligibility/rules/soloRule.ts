import { AirportLevel, RuleInput, RuleResult, LEVEL_ORDER, levelRank } from '../types';
import { EndorsementService } from '@/lib/endorsements/endorsementService';
import { GroupService } from '@/lib/endorsements/groupService';

/**
 * Solo Rule.
 * A valid solo for this airport/FIR at or above the requested level overrides the rating
 * requirement and grants access. The solo expiry date is added as a restriction.
 */
export function soloRule(input: RuleInput): RuleResult {
  const { level, data } = input;

  const highestSoloPosition = EndorsementService.getHighestEndorsement(data.relevantSoloPositions);
  if (!highestSoloPosition) {
    return { allowed: false, blockReason: 'kein Solo für diesen Airport' };
  }

  const soloGroup = EndorsementService.extractGroupFromEndorsement(highestSoloPosition);
  if (levelRank(soloGroup as AirportLevel) < levelRank(level)) {
    return {
      allowed: false,
      blockReason: `Solo nur bis ${soloGroup}, nicht ausreichend für ${level}`,
    };
  }

  // Build solo restriction string
  const soloRecord = data.solos.find((s) => s.position === highestSoloPosition);
  const dateStr = soloRecord?.expiry.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  }) ?? null;

  const sector = GroupService.getSector(highestSoloPosition);
  let restriction: string;
  if (sector) {
    restriction = `solo: ${sector}` + (dateStr ? ` bis ${dateStr}` : '');
  } else {
    restriction = 'solo' + (dateStr ? `: bis ${dateStr}` : '');
  }

  return { allowed: true, restriction };
}
