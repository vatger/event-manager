// types/signups.ts
import { EndorsementResponse } from "@/lib/endorsements/types";
import { User } from "@prisma/client";

export interface SignupTableUser extends Pick<User, "cid" | "name" | "rating"> {}

export interface SignupTableEntry {
  id: number;
  user: SignupTableUser;
  preferredStations?: string;
  remarks?: string;
  availability?: {
    available?: { start: string; end: string }[];
    unavailable?: { start: string; end: string }[];
  };
  endorsement?: EndorsementResponse | null;
}

export interface SignupTableResponse {
  eventId: number;
  signups: SignupTableEntry[];
  cached: boolean; // true, wenn Daten aus Cache stammen
}
