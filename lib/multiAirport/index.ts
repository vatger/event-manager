/**
 * Central export point for multi-airport event utilities
 * CLIENT-SAFE: These utilities can be safely imported by client components
 * 
 * For server-only utilities (database access), import from:
 * - selectedAirportsUtils.server.ts
 */

// Airport utilities
export {
  parseEventAirports,
  getExcludedAirports,
} from './airportUtils';

// Endorsement utilities
export {
  fetchAirportEndorsements,
  getHighestEndorsementGroup,
  getAirportEndorsementGroup,
  getAirportRestrictions,
  hasValidEndorsement,
  ENDORSEMENT_GROUP_PRIORITY,
} from './endorsementUtils';

export type { AirportEndorsementResult } from './endorsementUtils';

// Selected airports utilities (CLIENT-SAFE ONLY)
export {
  getSelectedAirportsForDisplay,
} from './selectedAirportsUtils';
