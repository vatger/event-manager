/** Lokaler Arbeitsstand, den das Eventteam zu einem CPT pflegt. */
export interface CptStatus {
  posted: boolean;
  postedAt: string | null;
  postedByCID: number | null;
  postedByName: string | null;
}

/** Ein CPT der Training-API samt FIR-Zuordnung und Arbeitsstand. */
export interface CptEntry {
  id: number;
  trainee_vatsim_id: number;
  trainee_name: string;
  examiner_vatsim_id: number;
  examiner_name: string;
  local_vatsim_id: number;
  local_name: string;
  course_name: string;
  position: string;
  date: string;
  confirmed: boolean;
  firCode: string | null;
  status: CptStatus;
}

export interface CptResponsible {
  userCID: number;
  name: string;
  rating: string | null;
}

export interface CptFirPermissions {
  canEditStatus: boolean;
  canEditResponsibles: boolean;
}

export interface CptApiResponse {
  data: CptEntry[];
  permissions: Record<string, CptFirPermissions>;
  responsibles: Record<string, CptResponsible[]>;
}

/** Wonach die Liste gefiltert wird. */
export type CptFilter = "all" | "open" | "posted" | "urgent";
