import { isAirportTier1 } from '@/utils/configUtils';
import { EndorsementService } from './endorsementService';
import { getCachedUserEndorsements, getCachedUserFamiliarizations, getCachedUserSolos } from '@/lib/training/cacheService';
import { ControllerGroup, EndorsementQueryParams, EndorsementResponse, MultiAirportEndorsementQueryParams, MultiAirportEndorsementResponse, AirportEndorsementResult } from './types';

export class GroupService {

  static async getControllerGroup(params: EndorsementQueryParams): Promise<EndorsementResponse> {
    const { user, event} = params;
    //Hole Daten aus der Datenbank
    const endorsements = await getCachedUserEndorsements(user.userCID)
    const solos = await getCachedUserSolos(user.userCID)
    const familiarizations = await getCachedUserFamiliarizations(user.userCID)
    const fir = event.fir;
    
    //Filtere Relevante Endorsements
    const relevantEndorsements = EndorsementService.getEndorsementsForAirport(
      endorsements,
      event.airport,
      event.fir
    );
    const relevantSolos = EndorsementService.getEndorsementsForAirport(
      solos.map(s => s.position),
      event.airport,
      event.fir
    );
      
    const isTier1 = isAirportTier1(event.airport)
    const famsMap = (familiarizations as { familiarizations: Record<string, string[]> }).familiarizations ?? {};
    const famsForFir: string[] = fir ? (famsMap[fir] ?? []) : [];
    
    const {group, restrictions, data} = isTier1 ? 
      this.calculateGroupTier1(user, relevantEndorsements, relevantSolos, famsForFir, solos)
      : this.calculateGroupNonTier1(user, relevantEndorsements, relevantSolos, famsForFir, solos)

    return {group, restrictions, endorsements, familiarizations: famsForFir, data}
  }

  private static calculateGroupTier1(
    user: { 
      userCID: number,
      rating: number
    },
    endorsements: string[],
    solos: string[],
    famsForFir?: string[],
    soloExpiryByPosition?: {position: string, expiry: Date}[]
  ): ControllerGroup{
    const highestEndorsement = EndorsementService.getHighestEndorsement(endorsements)
    const highestSolo = EndorsementService.getHighestEndorsement(solos)
    
    if (!highestEndorsement && !highestSolo) {
      return { group: null, restrictions: [], data: { endorsement: endorsements, solos, fams: famsForFir } }
    }
    
    const rankOf = (pos?: string) => {
      if (!pos) return -1
      const grp = EndorsementService.extractGroupFromEndorsement(pos)
      return EndorsementService.GROUP_ORDER.indexOf(grp)
    }

    const soloWins = rankOf(highestSolo!) > rankOf(highestEndorsement!)
    const chosenPos = soloWins ? highestSolo! : highestEndorsement!
    let group = EndorsementService.extractGroupFromEndorsement(chosenPos)

    const restrictions: string[] = []

    // Wenn Solo gewählt wurde: Restriction mit Expiry
    if (soloWins) {
      const solo = soloExpiryByPosition?.find((s) => s.position === highestSolo);
      const dateStr = solo?.expiry.toLocaleDateString() || null
      
      const sektor = this.getSector(highestSolo!)
      if(sektor){
        //CTR solo
        restrictions.push(`solo: ` + sektor +  (dateStr ? ` bis ${dateStr}` : ""))
      } else {
        restrictions.push(`solo: bis ${dateStr}`)
      }
    }

    // Rating >= 5 und weniger als 3 FAMs in FIR => FAM-only Hinweis
    if (user.rating >= 5) {
      const fams = famsForFir ?? []
      if (fams.length < 3 && fams.length != 0) {
        group = "CTR"
        const label = fams.join(', ')
        restrictions.push(`${label} only`)
        //Prüfe ob APP endorsement vorhanden
        if (!endorsements.some(e => e.includes("_APP"))) {
          restrictions.push("no APP");
        }
      } else if (fams.length == 3){
        group = "CTR"
        //Prüfe ob APP endorsement vorhanden
        if (!endorsements.some(e => e.includes("_APP"))) {
          restrictions.push("no APP");
        }
      }
    }

    return {
      group: group || null,
      restrictions,
      data: { endorsement: endorsements, solos, fams: famsForFir }
    }
  }

  private static calculateGroupNonTier1 (
    user: { 
      userCID: number,
      rating: number
    },
    endorsements: string[],
    solos: string[],
    famsForFir?: string[],
    soloExpiryByPosition?: {position: string, expiry: Date}[]
  ): ControllerGroup {
    let group = this.getGroupFromRating(user.rating);
    if(!group) return { group: null, restrictions: [], data: { endorsement: endorsements, solos, fams: famsForFir } }
    const highestSolo = EndorsementService.getHighestEndorsement(solos)
    const restrictions: string[] = []
    if(highestSolo){
      const soloGroup = EndorsementService.extractGroupFromEndorsement(highestSolo)
      const soloRank = EndorsementService.GROUP_ORDER.indexOf(soloGroup)
      const currentRank = EndorsementService.GROUP_ORDER.indexOf(group)

      if(soloRank > currentRank) {
        //Wenn solo über Ranking
        group = soloGroup
        const solo = soloExpiryByPosition?.find((s) => s.position === highestSolo);
        const dateStr = solo ? solo.expiry.toLocaleDateString() : null
        const sektor = this.getSector(highestSolo)
        restrictions.push("solo" + (sektor ? (": " + sektor) : "") + " " + (dateStr && ` bis ${dateStr}`))
      }
    }
    // Rating >= 5 (mind C1) und weniger als 3 FAMs in FIR => FAM-only Hinweis
    if (user.rating >= 5) {
      const fams = famsForFir ?? []
      if (fams.length < 3 && fams.length != 0) {
        group = "CTR"
        const label = fams.join(', ')
        restrictions.push(`${label} only`)
      } else if(fams.length == 3) {
        group = "CTR"
      } else {
        group = "APP"
      }
    }
    return {
      group: group || null,
      restrictions,
      data: { endorsement: endorsements, solos, fams: famsForFir }
    }
  }

  private static getGroupFromRating(rating: number): 'GND' | 'TWR' | 'APP' | 'CTR' | null{
    switch (rating) {
      case 2: return 'GND';
      case 3: return 'TWR';
      case 4: return 'APP';
      case 5: case 6: case 7: case 8: case 9: case 10: case 11: case 12: return 'CTR';
      default: return null;
    }
  }

  public static getSector(solo: string): string | null {
    const parts = solo.split("_");
    return parts.length === 3 ? parts[1] : null;
  }

  /**
   * Get endorsement information for multiple airports
   * This is used for multi-airport events to show which airports a user can control.
   * 
   * Algorithm:
   * 1. Fetch all endorsements, solos, and familiarizations for the user once
   * 2. For each airport in the event:
   *    - Filter endorsements relevant to that airport
   *    - Calculate the user's group level (GND/TWR/APP/CTR)
   *    - Determine any restrictions
   * 3. Calculate the highest group across all controllable airports
   * 
   * @param params - Contains user info (CID, rating) and event info (airports array, FIR)
   * @returns MultiAirportEndorsementResponse with per-airport results and overall highest group
   * 
   * Edge cases:
   * - If user has no endorsements for any airport, all airports will have canControl: false
   * - If airports array is empty, returns empty airports array with null highestGroup
   * - FIR is optional - if not provided, CTR endorsements won't be included
   */
  static async getMultiAirportEndorsements(params: MultiAirportEndorsementQueryParams): Promise<MultiAirportEndorsementResponse> {
    const { user, event } = params;
    
    // Get cached data once for all airports
    const endorsements = await getCachedUserEndorsements(user.userCID);
    const solos = await getCachedUserSolos(user.userCID);
    const familiarizations = await getCachedUserFamiliarizations(user.userCID);
    const fir = event.fir;
    
    const famsMap = (familiarizations as { familiarizations: Record<string, string[]> }).familiarizations ?? {};
    const famsForFir: string[] = fir ? (famsMap[fir] ?? []) : [];
    
    // Calculate endorsements for each airport
    const airportResults: AirportEndorsementResult[] = await Promise.all(
      event.airports.map(async (airport) => {
        const relevantEndorsements = EndorsementService.getEndorsementsForAirport(
          endorsements,
          airport,
          event.fir
        );
        const relevantSolos = EndorsementService.getEndorsementsForAirport(
          solos.map(s => s.position),
          airport,
          event.fir
        );
        
        const isTier1 = isAirportTier1(airport);
        
        const { group, restrictions } = isTier1 
          ? this.calculateGroupTier1(user, relevantEndorsements, relevantSolos, famsForFir, solos)
          : this.calculateGroupNonTier1(user, relevantEndorsements, relevantSolos, famsForFir, solos);
        
        return {
          airport,
          canControl: group !== null,
          group,
          restrictions
        };
      })
    );
    
    // Calculate highest group across all controllable airports
    const controllableAirports = airportResults.filter(r => r.canControl);
    let highestGroup: 'GND' | 'TWR' | 'APP' | 'CTR' | null = null;
    
    if (controllableAirports.length > 0) {
      const groupRanks = { 'GND': 0, 'TWR': 1, 'APP': 2, 'CTR': 3 };
      let maxRank = -1;
      
      for (const result of controllableAirports) {
        if (result.group) {
          const rank = groupRanks[result.group];
          if (rank > maxRank) {
            maxRank = rank;
            highestGroup = result.group;
          }
        }
      }
    }
    
    return {
      airports: airportResults,
      highestGroup,
      endorsements,
      familiarizations: famsForFir
    };
  }
  
}
