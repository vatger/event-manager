import { RuleInput, RuleResult } from '../types';

/**
 * Familiarization Rule (CTR only).
 * For CTR level, controllers with C1+ rating need sector familiarizations.
 * - 0 FAMs and rating >= C1: restricted to APP level (handled by engine via blocking CTR)
 * - 1–2 FAMs: CTR allowed but restricted to those sectors only
 * - 3+ FAMs: CTR fully allowed (no restriction added here)
 *
 * Exception: a FIR-level CTR endorsement (e.g. EDMM_CTR) grants full CTR access across the
 * entire FIR without requiring sector familiarizations.
 *
 * The rule only applies to CTR; other levels are always allowed.
 */
export function familiarizationRule(input: RuleInput): RuleResult {
  const { level, user, data, policy } = input;

  if (level !== 'CTR') {
    return { allowed: true };
  }

  // Familiarization only relevant for C1+ (rating >= 5)
  if (user.rating < 5) {
    return { allowed: true };
  }

  // A FIR-level CTR endorsement (e.g. EDMM_CTR) authorises full CTR access across the FIR
  // without requiring sector familiarizations.
  if (policy.fir) {
    const hasFirCtrEndorsement = data.endorsements.some(
      (e) => e.startsWith(`${policy.fir}_`) && e.endsWith('_CTR')
    );
    if (hasFirCtrEndorsement) {
      return { allowed: true };
    }
  }

  const fams = data.famsForFir;

  if (fams.length === 0) {
    // No FAMs at all – CTR is not accessible; fallback handled by engine
    return {
      allowed: false,
      blockReason: 'keine Familiarisierungen für dieses FIR',
    };
  }

  if (fams.length < 3) {
    // Partial FAMs – allow CTR but restrict to those sectors
    const label = fams.join(', ');
    return { allowed: true, restriction: `${label} only` };
  }

  // 3+ FAMs – full CTR access
  return { allowed: true };
}
