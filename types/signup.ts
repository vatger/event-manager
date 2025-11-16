import { TimeRange } from ".";

export interface SignupChange {
    field: string;
    oldValue: unknown;
    newValue: unknown;
    changedAt: string;
    changedBy: number;
}

export interface Signup {
    id: string | number;
    userCID?: string | number;
    user?: { cid?: string | number; name?: string; rating?: string };
    availability?: { available?: TimeRange[]; unavailable?: TimeRange[] };
    remarks?: string | null;
    preferredStations?: string;
    deletedAt?: string | null;
    deletedBy?: number | null;
    modifiedAfterDeadline?: boolean;
    changeLog?: SignupChange[] | null;
};
