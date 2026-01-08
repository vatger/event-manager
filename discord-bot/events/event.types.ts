export interface IWeeklyEvent {
    weekday: number; // 0 = Sonntag
    label: string;
  
    requiredStaffing: {
      [regex: string]: number;
    };
  
    channelId: string;
    pingId: string;
  }
  