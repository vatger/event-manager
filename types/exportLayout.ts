/**
 * Export Layout Configuration Types
 * Defines the structure for FIR-specific export layouts
 */

export interface TimeSlot {
  start: string;
  end: string;
}

export interface Availability {
  available: TimeSlot[];
  unavailable: TimeSlot[];
}

export interface User {
  id: number;
  cid: number;
  name: string;
  rating: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConvertedSignup {
  id: number;
  eventId: number;
  userCID: number;
  availability: Availability;
  breakrequests: string | null;
  preferredStations: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  user: User;
}

export interface ConvertedEvent {
  id: number;
  name: string;
  description: string;
  bannerUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  airports: string[];
  signupDeadline: string | null;
  staffedStations: string[];
  signupSlotMinutes: number | null;
  status: string;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
  signups: ConvertedSignup[];
}

export interface ComputedUserData {
  cid: number;
  group: string;
  restrictions: string[];
  airportEndorsements?: Record<string, { group?: string; restrictions: string[] }>;
}

/**
 * Configuration for an export layout
 */
export interface ExportLayoutConfig {
  /** Name of the layout */
  name: string;
  
  /** FIR code this layout applies to */
  firCode: string;
  
  /** Column headers for user details */
  userDetailColumns: string[];
  
  /** Order of endorsement groups to display */
  endorsementOrder: string[];
  
  /** Time interval for timeslots in minutes */
  timeslotInterval: number;
  
  /** Font configuration */
  fontFamily: string;
  
  /** Function to generate header rows */
  generateHeader?: (event: ConvertedEvent, timeslots: string[], currentDate: string) => string[][];
  
  /** Function to generate station rows */
  generateStationRows?: (event: ConvertedEvent, timeslots: string[], userDetailColumns: string[]) => string[][];
  
  /** Function to generate controller blocks */
  generateControllerBlocks?: (
    event: ConvertedEvent,
    timeslots: string[],
    userDetailColumns: string[],
    signupsByEndorsement: Record<string, ConvertedSignup[]>,
    computedData: Record<number, ComputedUserData>
  ) => string[][];
  
  /** Function to generate summary */
  generateSummary?: (event: ConvertedEvent, timeslots: string[]) => string[][];
  
  /** Function to generate formatting requests */
  generateFormatting?: (
    allValues: string[][],
    timeslots: string[],
    userDetailColumns: string[],
    signupsByEndorsement: Record<string, ConvertedSignup[]>,
    endorsementOrder: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any[];
}
