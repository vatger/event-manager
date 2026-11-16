import type { PermissionKey } from "@/lib/acl/catalog";
import type {
  Department,
  DepartmentSummary,
  MainAdmin,
  PersonAccess,
  TeamUserSearchResult,
  VatgerLeader,
} from "@/types/fir";

/**
 * Client für den Bereich „Team & Rechte“. Fehlerantworten der API werden als
 * Error mit der (deutschen) Meldung des Servers geworfen.
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });

  if (!res.ok) {
    let message = "Unbekannter Fehler";
    try {
      const data = await res.json();
      if (typeof data.error === "string") message = data.error;
    } catch {
      // Antwort ohne JSON – Standardmeldung behalten
    }
    throw new Error(message);
  }
  return res.json();
}

const groupUrl = (code: string, groupId: number) => `/api/firs/${code}/groups/${groupId}`;

export const teamApi = {
  listDepartments: () => request<DepartmentSummary[]>("/api/firs"),

  getDepartment: (code: string) => request<Department>(`/api/firs/${code}`),

  createGroup: (code: string, data: { name: string; description?: string }) =>
    request<{ id: number }>(`/api/firs/${code}/groups`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateGroup: (
    code: string,
    groupId: number,
    data: { name?: string; description?: string | null }
  ) => request(groupUrl(code, groupId), { method: "PATCH", body: JSON.stringify(data) }),

  deleteGroup: (code: string, groupId: number) =>
    request(groupUrl(code, groupId), { method: "DELETE" }),

  setGroupPermissions: (code: string, groupId: number, permissions: PermissionKey[]) =>
    request(`${groupUrl(code, groupId)}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),

  addGroupMember: (code: string, groupId: number, cid: number) =>
    request(`${groupUrl(code, groupId)}/members`, {
      method: "POST",
      body: JSON.stringify({ cid }),
    }),

  removeGroupMember: (code: string, groupId: number, cid: number) =>
    request(`${groupUrl(code, groupId)}/members?cid=${cid}`, { method: "DELETE" }),

  getPersonAccess: (code: string, cid: number) =>
    request<PersonAccess>(`/api/firs/${code}/people/${cid}`),

  removeFromDepartment: (code: string, cid: number) =>
    request(`/api/firs/${code}/people/${cid}`, { method: "DELETE" }),

  searchUsers: (query: string, signal?: AbortSignal) =>
    request<TeamUserSearchResult[]>(
      `/api/team/user-search?q=${encodeURIComponent(query)}`,
      { signal }
    ),

  getVatgerLeitung: () =>
    request<{ leaders: VatgerLeader[]; mainAdmins: MainAdmin[] }>("/api/admin/vatger-leaders"),

  addVatgerLeader: (cid: number) =>
    request(`/api/admin/vatger-leaders/${cid}`, { method: "POST" }),

  removeVatgerLeader: (cid: number) =>
    request(`/api/admin/vatger-leaders/${cid}`, { method: "DELETE" }),
};
