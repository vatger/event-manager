import { TimeRange } from ".";

export interface Signup {
    id: string | number;
    userCID?: string | number;
    user?: { cid?: string | number; name?: string; rating?: string };
    endorsement?: string;
    availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
    remarks?: string | null;
    preferredStations?: string;
};