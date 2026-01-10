export interface WeeklyEventConfigurationCreate {
  firId?: number;
  name: string;
  weekday: number; // 0-6 (Sunday-Saturday)
  weeksOn: number;
  weeksOff: number;
  startDate: Date | string;
  enabled?: boolean;
}

export interface WeeklyEventConfigurationUpdate {
  name?: string;
  weekday?: number;
  weeksOn?: number;
  weeksOff?: number;
  startDate?: Date | string;
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
  createdAt: Date;
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
