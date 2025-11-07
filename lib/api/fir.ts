import { FIR, CreateFIRData, Group, CurrentUser, Permission} from '@/types/fir';
import { User } from '@prisma/client';

class FIRAPI {
  private async fetchWithAuth(url: string, options?: RequestInit) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let message = "Unbekannter Fehler";
      try {
        const data = await res.json();
        message = data.error || data.message || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return res.json();
  }

  // FIR Management
  async getFIRs(): Promise<FIR[]> {
    return this.fetchWithAuth('/api/firs');
  }

  async createFIR(data: CreateFIRData): Promise<{ success: boolean; fir: FIR }> {
    return this.fetchWithAuth('/api/firs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Group Management
  async getFIRGroups(firCode: string): Promise<Group[]> {
    return this.fetchWithAuth(`/api/firs/${firCode}/groups`);
  }

  async addGroupMember(firCode: string, groupId: number, cid: number): Promise<unknown> {
    return this.fetchWithAuth(`/api/firs/${firCode}/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ cid }),
    });
  }

  async removeGroupMember(firCode: string, groupId: number, cid: string): Promise<{ success: boolean }> {
    return this.fetchWithAuth(`/api/firs/${firCode}/groups/${groupId}/members?cid=${cid}`, {
      method: 'DELETE',
    });
  }

   // Lade alle verfügbaren Permissions
   async getAvailablePermissions(): Promise<Permission[]> {
    return this.fetchWithAuth('/api/permissions');
  }

  async updateGroupPermissions(
    firCode: string,
    groupId: number,
    updates: Array<{ permissionId: number; scope: string }>
  ): Promise<{ success: boolean; message?: string }> {
    return this.fetchWithAuth(`/api/firs/${firCode}/groups/${groupId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getCurrentUser(): Promise<CurrentUser> {
    return this.fetchWithAuth('/api/user/me');
  }
}

export const firApi = new FIRAPI();