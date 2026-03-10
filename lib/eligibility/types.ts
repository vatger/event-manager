/** Ordered level hierarchy: DEL < GND < TWR < APP < CTR */
export type AirportLevel = 'DEL' | 'GND' | 'TWR' | 'APP' | 'CTR';

export const LEVEL_ORDER: AirportLevel[] = ['DEL', 'GND', 'TWR', 'APP', 'CTR'];

export function levelRank(level: AirportLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

/** Airport-specific policy derived from datahub station data */
export interface AirportPolicy {
  airport: string;
  fir?: string;
  isTier1: boolean;
  /** From which level a T1 endorsement is required (tier1 airports: TWR) */
  tier1RequiredFrom?: AirportLevel;
  /** Whether an AFIS/T2 endorsement is required (gcapStatus === 'AFIS') */
  requiresAfis: boolean;
  /** Whether the TWR station can be staffed with S1 (GND level) rating */
  s1TwrAllowed: boolean;
  /** Maximum level allowed for S1-theory-only controllers (if applicable) */
  s1TheoryMaxLevel?: AirportLevel;
  /** Required course IDs per level (keyed by AirportLevel) */
  requiredCourses?: Partial<Record<AirportLevel, string[]>>;
}

/** Input to an individual rule for a given level */
export interface RuleInput {
  level: AirportLevel;
  user: {
    userCID: number;
    rating: number;
  };
  policy: AirportPolicy;
  data: EligibilityData;
}

/** Result of evaluating a single rule for a given level */
export interface RuleResult {
  /** Whether this rule allows the level */
  allowed: boolean;
  /** Short human-readable reason added to restrictions if the level is granted */
  restriction?: string;
  /** Short reason explaining why the level is blocked (for debug/reasonsPerLevel) */
  blockReason?: string;
}

/** All training + mock data needed by the engine */
export interface EligibilityData {
  /** T1 endorsements (e.g. "EDDM_TWR", "EDDM_APP") – for this airport/FIR */
  endorsements: string[];
  /** All T1 endorsements (unfiltered, for "no APP" checks) */
  allEndorsements: string[];
  /** Solo positions with expiry (e.g. {position: "EDDM_TWR", expiry: Date}) */
  solos: { position: string; expiry: Date }[];
  /** Solo positions filtered to this airport/FIR */
  relevantSoloPositions: string[];
  /** Familiarization sectors for the relevant FIR */
  famsForFir: string[];
  /** Whether the user is on the active roster (mock: always true) */
  isOnRoster: boolean;
  /** Whether the user is on the S1-theory-only roster (mock: always false) */
  isS1TheoryOnly: boolean;
  /** T2/AFIS endorsement identifiers for the user (mock: empty) */
  t2AfisEndorsements: string[];
  /** Missing required course IDs per level (mock: empty) */
  missingCourses: Partial<Record<AirportLevel, string[]>>;
}

/** Per-level evaluation detail (for debug / Roster Editor) */
export interface LevelEvaluation {
  level: AirportLevel;
  allowed: boolean;
  /** Restrictions that apply if this level is chosen */
  restrictions: string[];
  /** Reasons why this level is blocked (non-empty only when allowed === false) */
  blockReasons: string[];
}

/** Result produced by EligibilityEngine.evaluate() */
export interface EligibilityResult {
  /** The highest level the user may be assigned to, or null if none */
  maxAllowedGroup: 'GND' | 'TWR' | 'APP' | 'CTR' | null;
  /** Restrictions that apply to the maxAllowedGroup (displayed in UI) */
  restrictions: string[];
  /** Per-level breakdown for debugging / Roster Editor */
  reasonsPerLevel: LevelEvaluation[];
}
