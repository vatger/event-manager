export class EndorsementService {
  static readonly GROUP_ORDER = ['GND', 'TWR', 'APP', 'CTR'] as const;

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