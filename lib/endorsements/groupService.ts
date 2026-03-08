import { EndorsementQueryParams, EndorsementResponse } from './types';
import { EligibilityEngine } from '@/lib/eligibility/engine';
import { buildAirportPolicy } from '@/lib/eligibility/policyService';
import { loadEligibilityData } from '@/lib/eligibility/dataLoader';

export class GroupService {

  static async getControllerGroup(params: EndorsementQueryParams): Promise<EndorsementResponse> {
    const { user, event } = params;

    const policy = await buildAirportPolicy(event.airport, event.fir);
    const data = await loadEligibilityData(user.userCID, policy);

    const { maxAllowedGroup, restrictions } = EligibilityEngine.evaluate(user, policy, data);

    return {
      group: maxAllowedGroup,
      restrictions,
      endorsements: data.allEndorsements,
      familiarizations: data.famsForFir,
      data: {
        endorsement: data.endorsements,
        solos: data.relevantSoloPositions,
        fams: data.famsForFir,
      },
    };
  }

  /** Extract the sector segment from a solo position string (e.g. "EDMM_SECTOR_CTR" → "SECTOR") */
  public static getSector(solo: string): string | null {
    const parts = solo.split("_");
    return parts.length === 3 ? parts[1] : null;
  }
}
