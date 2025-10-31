export interface Event {
    id: string;
    name: string;
    description: string;
    bannerUrl: string;
    airports: string;
    startTime: string;
    endTime: string;
    staffedStations: string[];
    signupDeadline: string;
    registrations: number;
    status: "PLANNING" | "SIGNUP_OPEN" | "SIGNUP_CLOSED" | "ROSTER_PUBLISHED" | "DRAFT" | "CANCELLED";
    isSignedUp?: boolean;
    rosterlink?: string;
    firCode: string;
}