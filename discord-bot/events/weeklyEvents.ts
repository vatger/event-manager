import { IWeeklyEvent } from "./event.types";

export const weeklyEvents: IWeeklyEvent[] = [
  {
    weekday: 5,
    label: "Frankfurt Friday",
    requiredStaffing: {
      "ED(?:GG_[GRHDB]|UU_[FSW]).._CTR": 2,
      "EDDF_._APP": 2,
      "EDDF_._TWR": 2,
      "EDDF_._GND": 2,
      "EDDF_DEL": 1,
    },
    channelId: "1200342520731807786",
    pingId: "1416563224286990429",
  },
] as const;
