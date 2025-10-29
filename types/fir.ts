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
    kind: "FIR_TEAM" | "FIR_LEITUNG" | "GLOBAL_VATGER_LEITUNG" | "CUSTOM";
    description?: string;
    members?: GroupMember[];
    permissions?: Permission[];
    fir?: FIR | null;
  }
  
  export interface FIR {
    id: number;
    code: string;
    name: string;
    groups?: Group[];
  }
  
  export interface CurrentUser {
    cid: number;
    name: string;
    rating: string;
    role: "USER" | "MAIN_ADMIN";
    fir: FIR | null;
    groups: Group[];
  
    /** Alle global gültigen Permissions */
    effectivePermissions: string[];
  
    /** FIR-spezifische Berechtigungen: FIR-Code -> Permission[] */
    firScopedPermissions: Record<string, string[]>;
  
    /** Globales Level des Nutzers */
    effectiveLevel: "USER" | "FIR_EVENTLEITER" | "VATGER_LEITUNG" | "MAIN_ADMIN";
  
    /** FIR-spezifische Rollen: FIR-Code -> "FIR_EVENTLEITER" | "FIR_TEAM" */
    firLevels: Record<string, "FIR_EVENTLEITER" | "FIR_TEAM">;
  }
  
  export interface CreateFIRData {
    code: string;
    name: string;
  }