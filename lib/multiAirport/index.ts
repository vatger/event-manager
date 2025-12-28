/**
 * Central export point for multi-airport event utilities
 * Makes it easy to import utilities with a single import statement
 */

// Airport utilities
export {
  parseEventAirports,
  parseOptOutAirports,
  isAirportOptedOut,
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

// Selected airports utilities
export {
  computeSelectedAirports,
  computeSelectedAirportsSync,
  getSelectedAirportsForDisplay,
} from './selectedAirportsUtils';
