import { AirportLevel } from '@/lib/eligibility/types';

export class EndorsementService {
  static readonly GROUP_ORDER = ['GND', 'TWR', 'APP', 'CTR'] as const;

  /**
   * Combined endorsements that cover multiple levels.
   * Key: endorsement suffix (without leading underscore), Value: levels it covers.
   * Example: "GNDDEL" appears as "AIRPORT_GNDDEL" and covers both GND and DEL.
   */
  private static readonly COMBINED_ENDORSEMENTS: Record<string, AirportLevel[]> = {
    GNDDEL: ['GND', 'DEL'],
  };

  /**
   * Returns true if the given endorsement covers the requested ATC level.
   * Handles combined endorsements (e.g. GNDDEL covers both GND and DEL) as well as
   * standard single-level endorsements (GND, TWR, APP, CTR).
   */
  public static endorsementCoversLevel(endorsement: string, level: AirportLevel): boolean {
    // Check combined endorsements first
    for (const [suffix, levels] of Object.entries(this.COMBINED_ENDORSEMENTS)) {
      if (endorsement.includes(`_${suffix}`)) {
        return levels.includes(level);
      }
    }
    // Fall back to single-level matching
    return this.extractGroupFromEndorsement(endorsement) === level;
  }

  static getEndorsementsForAirport(
    endorsements: string[],
    airport: string, 
    fir?: string
  ): string[] {
    const airportEndorsements = endorsements.filter(endorsement => 
      endorsement.startsWith(`${airport}_`)
    );

    const ctrEndorsements = fir ? endorsements.filter(endorsement => 
      endorsement.startsWith(`${fir}_`) && endorsement.endsWith('_CTR')
    ) : [];

    return [...airportEndorsements, ...ctrEndorsements];
  }

  static getHighestEndorsement(endorsements: string[]): string | null {
    if (endorsements.length === 0) return null;

    let highestEndorsement = endorsements[0];
    let highestRank = -1;

    for (const endorsement of endorsements) {
      const group = this.extractGroupFromEndorsement(endorsement);
      const rank = this.GROUP_ORDER.indexOf(group);
      
      if (rank > highestRank) {
        highestRank = rank;
        highestEndorsement = endorsement;
      }
    }

    return highestEndorsement;
  }

  public static extractGroupFromEndorsement(endorsement: string): 'GND' | 'TWR' | 'APP' | 'CTR' {
    if (endorsement.includes('_GND')) return 'GND';
    if (endorsement.includes('_TWR')) return 'TWR';
    if (endorsement.includes('_APP')) return 'APP';
    if (endorsement.includes('_CTR')) return 'CTR';
    return 'GND'; // Fallback
  }
}