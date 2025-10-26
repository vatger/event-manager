export type FIR = { id: number; code: string; name: string };

export type Group = {
    id: number
    name: string
    description: string | null
    firId: number | null
    createdAt: Date
    updatedAt: Date
  }

export type Member = {
  user: { cid: number; name: string; rating: string };
};

export type PermissionRow = {
  id: number;
  key: string;
  description?: string | null;
  assignedScope: "OWN_FIR" | "ALL" | null;
};
