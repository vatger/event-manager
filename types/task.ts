export type TaskType =
  | "CREATE_BANNER"
  | "CREATE_TEXT"
  | "SUBMIT_CLEARING"
  | "REGISTER_MYVATSIM"
  | "CUSTOM";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "SKIPPED";

export interface EventTask {
  id: number;
  eventId: number;
  type: TaskType;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  assigneeCID: number | null;
  myVatsimManualCheck: boolean;
  myVatsimRegistered: boolean | null;
  deadlineNotified: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    cid: number;
    name: string;
  } | null;
  event?: {
    id: number;
    name: string;
    startTime: string;
    firCode: string | null;
  };
}
