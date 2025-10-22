import { EndorsementService } from './endorsementService';
import { mockEndorsementsAPI, mockFamiliarizationsAPI } from './mockapi';
import { ControllerGroup, EventData } from './types';

export class GroupService {
  static async determineControllerGroup(
    cid: number,
    event: EventData,
    rating: number
  ): Promise<ControllerGroup> {
    const [endorsements, familiarizations] = await Promise.all([
      this.getUserEndorsements(cid),
      this.getUserFamiliarizations(cid)
    ]);

    const relevantEndorsements = EndorsementService.getEndorsementsForAirport(
      endorsements,
      event.airport,
      event.fir
    );

    // Bei Tier 1 Airports: Endorsements haben Priorität
    if (event.isTier1) {
      return this.calculateGroupFromEndorsements(
        relevantEndorsements,
        familiarizations,
        event,
        rating
      );
    }

    // Bei Nicht-Tier 1: Rating-basierte Einteilung mit Endorsement-Override
    return this.calculateGroupFromRating(
      rating,
      relevantEndorsements,
      familiarizations,
      event
    );
  }

  private static async getUserEndorsements(cid: number): Promise<string[]> {
    // Hier Ihre Mock- oder echte API-Implementierung
    return mockEndorsementsAPI(cid);
  }

  private static async getUserFamiliarizations(cid: number): Promise<any> {
    // Hier Ihre Mock- oder echte API-Implementierung
    return mockFamiliarizationsAPI(cid);
  }

  private static calculateGroupFromEndorsements(
    endorsements: string[],
    familiarizations: any,
    event: EventData,
    rating: number
  ): ControllerGroup {
    const highestEndorsement = EndorsementService.getHighestEndorsement(endorsements);
    if(!highestEndorsement) return {remarks: [], endorsements: [], group: null}
    let group = highestEndorsement 
      && EndorsementService.extractGroupFromEndorsement(highestEndorsement);

    const remarks = this.generateRemarks(
      group,
      endorsements,
      familiarizations,
      event,
      rating
    );

    if(rating >= 5){
        const onlyFams = this.getonlyFamiliarizations(familiarizations, event.fir);
        if (onlyFams.length < 3) {
            remarks.push(`CTR: ${onlyFams.join(', ')} only`);
        }
        if(group !== "APP" && group !== "CTR") remarks.push("no APP")
        //CTR, wenn mindestens 1 Familiarization (onyl Fams 3 -> keine Fam)
        if(onlyFams.length >= 2){
            group = "CTR"
        }
    }

    return {
      group: group || null,
      remarks,
      endorsements
    };
  }

  private static calculateGroupFromRating(
    rating: number,
    endorsements: string[],
    familiarizations: any,
    event: EventData
  ): ControllerGroup {
    let group = this.getGroupFromRating(rating);
    if(!group) return {group, remarks: [], endorsements: [] }

    const remarks: string[] = [];

    // Check for endorsement overrides
    const highestEndorsement = EndorsementService.getHighestEndorsement(endorsements);
    if (highestEndorsement) {
      const endorsementGroup = EndorsementService.extractGroupFromEndorsement(highestEndorsement);
      const endorsementRank = EndorsementService.GROUP_ORDER.indexOf(endorsementGroup);
      const currentRank = EndorsementService.GROUP_ORDER.indexOf(group);

      if (endorsementRank > currentRank) {
        group = endorsementGroup;
        //RMKs wenn CTR solos
        if(highestEndorsement.includes("_CTR")) 
          remarks.push(`Solo: ${highestEndorsement}`);
      }
    }

    // CTR mit Familiarization-Check
    if (group === 'CTR') {
      const onlyFams = this.getonlyFamiliarizations(familiarizations, event.fir);
        if (onlyFams.length < 3) {
            remarks.push(`CTR: ${onlyFams.join(', ')} only`);
        }
    }

    return { group, remarks, endorsements };
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

  private static generateRemarks(
    group: string,
    endorsements: string[],
    familiarizations: any,
    event: EventData,
    rating: number
  ): string[] {
    const remarks: string[] = [];

    // CTR Familiarization Remarks
    if (group === 'CTR') {
      const highestEndorsement = EndorsementService.getHighestEndorsement(endorsements)
      if(highestEndorsement?.includes("_CTR")){
        // CTR solo
        remarks.push(`solo: ${highestEndorsement}`)
      } else {
        const onlyFams = this.getonlyFamiliarizations(familiarizations, event.fir);
        if (onlyFams.length < 3) {
            remarks.push(`CTR: ${onlyFams.join(', ')} only`);
        }
      }
    }

    return remarks;
  }

  private static getMissingFamiliarizations(familiarizations: any, fir: string): string[] {
    const config = this.getFIRConfig(fir);
    if (!config) return [];

    const userGroups = familiarizations.familiarizations?.[fir] || [];
    return config.airspaceGroups.filter(group => !userGroups.includes(group));
  }
  private static getonlyFamiliarizations(familiarizations: any, fir: string): string[] {
    const config = this.getFIRConfig(fir);
    if (!config) return [];

    const userGroups = familiarizations.familiarizations?.[fir] || [];
    return config.airspaceGroups.filter(group => userGroups.includes(group));
  }

  private static getFIRConfig(fir: string) {
    // Ihre FIR-Konfiguration hier
    const firConfigs = {
      'EDMM': { airspaceGroups: ['STA', 'HOF', 'ALB'] },
      'EDGG': { airspaceGroups: ['EDGG_N', 'EDGG_S', 'EDGG_E'] }
    };
    return firConfigs[fir as keyof typeof firConfigs];
  }
}