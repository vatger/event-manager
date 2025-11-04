export interface AirportEndorsement {
  airport: string;
  position: string;
  fullEndorsement: string;
}

/**
 * Extrahiert Airport und Position aus Endorsement-String
 * Beispiel: "EDDM_TWR" -> { airport: "EDDM", position: "TWR" }
 */
export function parseEndorsement(endorsement: string | null | undefined): AirportEndorsement | null {
  if (!endorsement || typeof endorsement !== 'string') return null;
  
  const match = endorsement.match(/^([A-Z]{4})_(.+)$/);
  if (!match) return null;
  
  return {
    airport: match[1],
    position: match[2],
    fullEndorsement: endorsement
  };
}

/**
 * Filtert Endorsements für einen spezifischen Airport
 */
export function getEndorsementsForAirport(endorsements: string[] | null | undefined, airport: string): AirportEndorsement[] {
  if (!endorsements || !Array.isArray(endorsements)) return [];
  
  return endorsements
    .map(parseEndorsement)
    .filter((endorsement): endorsement is AirportEndorsement => 
      endorsement !== null && endorsement.airport === airport
    );
}

/**
 * Gruppiert Endorsements nach Position/Gruppe
 */
export function groupEndorsementsByPosition(endorsements: AirportEndorsement[]): Record<string, string[]> {
  return endorsements.reduce((acc, endorsement) => {
    const position = endorsement.position;
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(endorsement.fullEndorsement);
    return acc;
  }, {} as Record<string, string[]>);
}

/**
 * Mappt Trainings-Endorsements zu verfügbaren Stationen-Gruppen
 */
export function mapEndorsementsToStationGroups(endorsements: AirportEndorsement[]): string[] {
  const positionGroups: Record<string, string> = {
    'GNDDEL': 'GND',
    'GND': 'GND', 
    'DEL': 'GND',
    'TWR': 'TWR',
    'APP': 'APP',
    'DEP': 'APP',
    'CTR': 'CTR'
  };
  
  const groups = new Set<string>();
  
  endorsements.forEach(endorsement => {
    const group = positionGroups[endorsement.position];
    if (group) {
      groups.add(group);
    }
  });
  
  return Array.from(groups);
}