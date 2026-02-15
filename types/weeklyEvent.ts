export interface WeeklyEventConfigurationCreate {
  firId?: number;
  name: string;
  weekday: number; // 0-6 (Sunday-Saturday)
  weeksOn: number;
  weeksOff: number;
  startDate: Date | string;
  airports?: string[]; // Array of ICAO codes
  startTime?: string; // HH:mm format (UTC)
  endTime?: string; // HH:mm format (UTC)
  description?: string;
  minStaffing?: number;
  requiresRoster?: boolean;
  staffedStations?: string[]; // Array of station callsigns
  signupDeadlineHours?: number;
  enabled?: boolean;
}

export interface WeeklyEventConfigurationUpdate {
  name?: string;
  weekday?: number;
  weeksOn?: number;
  weeksOff?: number;
  startDate?: Date | string;
  airports?: string[];
  startTime?: string;
  endTime?: string;
  description?: string;
  minStaffing?: number;
  requiresRoster?: boolean;
  staffedStations?: string[];
  signupDeadlineHours?: number;
  enabled?: boolean;
}

export interface WeeklyEventOccurrenceData {
  id: number;
  configId: number;
  date: Date;
  myVatsimChecked: boolean;
  myVatsimRegistered: boolean | null;
  staffingChecked: boolean;
  staffingSufficient: boolean | null;
  signupDeadline: Date | null;
  rosterPublishedAt: Date | null;
  eventId: number | null;
  createdAt: Date;
}

export interface WeeklyEventSignupCreate {
  occurrenceId: number;
  userCID: number;
  remarks?: string;
}

export interface WeeklyEventSignupData {
  id: number;
  occurrenceId: number;
  userCID: number;
  remarks: string | null;
  endorsementGroup: string | null; // GND, TWR, APP, CTR
  restrictions: string | null; // JSON array of restrictions
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyEventRosterAssignment {
  occurrenceId: number;
  userCID: number;
  station: string;
}

export interface WeeklyEventRosterData {
  id: number;
  occurrenceId: number;
  userCID: number;
  station: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscordBotConfigurationData {
  id: number;
  firId: number | null;
  defaultChannelId: string | null;
  eventRegistrationDeadlineDays: number;
  staffingCheckTime: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
