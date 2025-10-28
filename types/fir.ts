export interface User {
    id: number;
    cid: string;
    name: string;
    rating: string;
    role: string;
  }
  
  export interface Permission {
    id: number,
    key: string;
    description?: string;
    scope: string;
  }
  
  export interface GroupMember {
    id: number;
    cid: string;
    name: string;
    rating: string;
    role: string;
  }
  
  export interface Group {
    id: number;
    name: string;
    kind: 'FIR_LEITUNG' | 'FIR_TEAM';
    description: string;
    members: GroupMember[];
    permissions: Permission[];
  }
  
  export interface FIR {
    id: number;
    code: string;
    name: string;
    groups: Group[];
  }
  
  export interface CurrentUser {
    id: number;
    cid: string;
    name: string;
    rating: string;
    role: string;
    firMemberships: Array<{
      fir: {
        id: number;
        code: string;
        name: string;
      } | null;
      group: {
        id: number;
        name: string;
        kind: string;
      };
    }>;
    effectivePermissions: string[];
    effectiveLevel: {level: 'MAIN_ADMIN' | 'VATGER_LEITUNG' | 'FIR_LEITUNG' | 'FIR_TEAM' | 'USER', firId?: number};
  }
  
  export interface CreateFIRData {
    code: string;
    name: string;
  }